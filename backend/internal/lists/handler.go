package lists

import (
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"todo/internal/api"
	"todo/internal/platform/db"
	"todo/internal/platform/httpjson"
	"todo/internal/platform/problem"
	"todo/internal/platform/requestlog"
	"todo/internal/platform/validate"
	"todo/internal/store"
)

type Handler struct {
	pool    *pgxpool.Pool
	queries *store.Queries
	now     func() time.Time
}

func New(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool, queries: store.New(pool), now: func() time.Time { return time.Now().UTC() }}
}

func (h *Handler) ListLists(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListLists(r.Context())
	if err != nil {
		requestlog.From(r.Context()).Error("list lists", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	page := api.ListPage{Items: make([]api.List, 0, len(rows))}
	for _, row := range rows {
		page.Items = append(page.Items, api.List{
			Id:        row.ID,
			Title:     row.Title,
			Position:  row.Position,
			CreatedAt: row.CreatedAt.UTC(),
			UpdatedAt: row.UpdatedAt.UTC(),
		})
	}
	httpjson.Write(w, http.StatusOK, page)
}

func (h *Handler) CreateList(w http.ResponseWriter, r *http.Request) {
	var body api.CreateList
	if err := httpjson.Decode(w, r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	title, err := validate.Title(body.Title)
	if err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	id, err := h.queries.CreateList(r.Context(), store.CreateListParams{
		ID:    uuid.Must(uuid.NewV7()),
		Title: title,
		Now:   h.now(),
	})
	if err != nil {
		requestlog.From(r.Context()).Error("create list", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	httpjson.Write(w, http.StatusCreated, api.Created{Id: id})
}

func (h *Handler) UpdateList(w http.ResponseWriter, r *http.Request, listId openapi_types.UUID) {
	var body api.UpdateList
	if err := httpjson.Decode(w, r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	title, err := validate.Title(body.Title)
	if err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	if _, err := h.queries.UpdateList(r.Context(), store.UpdateListParams{ID: listId, Title: title, Now: h.now()}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			problem.Write(w, r, problem.Missing("list does not exist"))
			return
		}
		requestlog.From(r.Context()).Error("update list", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteList(w http.ResponseWriter, r *http.Request, listId openapi_types.UUID) {
	if _, err := h.queries.DeleteList(r.Context(), listId); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			problem.Write(w, r, problem.Missing("list does not exist"))
			return
		}
		requestlog.From(r.Context()).Error("delete list", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ReorderLists(w http.ResponseWriter, r *http.Request) {
	var body api.ListOrder
	if err := httpjson.Decode(w, r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	if err := validate.Order(body.ListIds, "listIds"); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	positions := validate.Positions(body.ListIds)
	err := db.InTransaction(r.Context(), h.pool, func(tx pgx.Tx) error {
		queries := h.queries.WithTx(tx)
		now := h.now()
		for _, id := range validate.LockOrder(body.ListIds) {
			if _, err := queries.MoveList(r.Context(), store.MoveListParams{Position: positions[id], Now: now, ID: id}); err != nil {
				return err
			}
		}
		count, err := queries.CountLists(r.Context())
		if err != nil {
			return err
		}
		if count != int64(len(body.ListIds)) {
			return validate.ErrIncompleteOrder
		}
		return nil
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			problem.Write(w, r, problem.Missing("list does not exist"))
		case errors.Is(err, validate.ErrIncompleteOrder):
			problem.Write(w, r, problem.Conflict(err.Error()))
		default:
			requestlog.From(r.Context()).Error("reorder lists", "error", err)
			problem.Write(w, r, problem.InternalError())
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
