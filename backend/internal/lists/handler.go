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
	"todo/internal/platform/httpjson"
	"todo/internal/platform/problem"
	"todo/internal/platform/requestlog"
	"todo/internal/platform/validate"
	"todo/internal/store"
)

type Handler struct {
	queries *store.Queries
	now     func() time.Time
}

func New(pool *pgxpool.Pool) *Handler {
	return &Handler{queries: store.New(pool), now: func() time.Time { return time.Now().UTC() }}
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
