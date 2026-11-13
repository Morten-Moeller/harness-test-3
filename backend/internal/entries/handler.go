package entries

import (
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

const foreignKeyViolation = "23503"

type Handler struct {
	pool    *pgxpool.Pool
	queries *store.Queries
	now     func() time.Time
}

func New(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool, queries: store.New(pool), now: func() time.Time { return time.Now().UTC() }}
}

func (h *Handler) ListEntries(w http.ResponseWriter, r *http.Request) {
	rows, err := h.queries.ListEntries(r.Context())
	if err != nil {
		requestlog.From(r.Context()).Error("list entries", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	page := api.EntryPage{Items: make([]api.Entry, 0, len(rows))}
	for _, row := range rows {
		page.Items = append(page.Items, api.Entry{
			Id:        row.ID,
			ListId:    row.ListID,
			Title:     row.Title,
			Done:      row.Done,
			Position:  row.Position,
			CreatedAt: row.CreatedAt.UTC(),
			UpdatedAt: row.UpdatedAt.UTC(),
		})
	}
	httpjson.Write(w, http.StatusOK, page)
}

func (h *Handler) CreateEntry(w http.ResponseWriter, r *http.Request, listId openapi_types.UUID) {
	var body api.CreateEntry
	if err := httpjson.Decode(w, r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	title, err := validate.Title(body.Title)
	if err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	id, err := h.queries.CreateEntry(r.Context(), store.CreateEntryParams{
		ID:     uuid.Must(uuid.NewV7()),
		ListID: listId,
		Title:  title,
		Now:    h.now(),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolation {
			problem.Write(w, r, problem.Missing("list does not exist"))
			return
		}
		requestlog.From(r.Context()).Error("create entry", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	httpjson.Write(w, http.StatusCreated, api.Created{Id: id})
}

func (h *Handler) UpdateEntry(w http.ResponseWriter, r *http.Request, entryId openapi_types.UUID) {
	var body api.UpdateEntry
	if err := httpjson.Decode(w, r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	if body.Title == nil && body.Done == nil {
		problem.Write(w, r, problem.Validation("title or done is required"))
		return
	}
	params := store.UpdateEntryParams{ID: entryId, Done: body.Done, Now: h.now()}
	if body.Title != nil {
		title, err := validate.Title(*body.Title)
		if err != nil {
			problem.Write(w, r, problem.Validation(err.Error()))
			return
		}
		params.Title = &title
	}
	if _, err := h.queries.UpdateEntry(r.Context(), params); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			problem.Write(w, r, problem.Missing("entry does not exist"))
			return
		}
		requestlog.From(r.Context()).Error("update entry", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteEntry(w http.ResponseWriter, r *http.Request, entryId openapi_types.UUID) {
	if _, err := h.queries.DeleteEntry(r.Context(), entryId); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			problem.Write(w, r, problem.Missing("entry does not exist"))
			return
		}
		requestlog.From(r.Context()).Error("delete entry", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ReorderEntries(w http.ResponseWriter, r *http.Request, listId openapi_types.UUID) {
	var body api.EntryOrder
	if err := httpjson.Decode(w, r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	if err := validate.Order(body.EntryIds, "entryIds"); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	positions := validate.Positions(body.EntryIds)
	err := db.InTransaction(r.Context(), h.pool, func(tx pgx.Tx) error {
		queries := h.queries.WithTx(tx)
		now := h.now()
		for _, id := range validate.LockOrder(body.EntryIds) {
			_, err := queries.MoveEntry(r.Context(), store.MoveEntryParams{
				ListID:   listId,
				Position: positions[id],
				Now:      now,
				ID:       id,
			})
			if err != nil {
				return err
			}
		}
		count, err := queries.CountEntriesOfList(r.Context(), listId)
		if err != nil {
			return err
		}
		if count != int64(len(body.EntryIds)) {
			return validate.ErrIncompleteOrder
		}
		return nil
	})
	if err != nil {
		var pgErr *pgconn.PgError
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			problem.Write(w, r, problem.Missing("entry does not exist"))
		case errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolation:
			problem.Write(w, r, problem.Missing("list does not exist"))
		case errors.Is(err, validate.ErrIncompleteOrder):
			problem.Write(w, r, problem.Conflict(err.Error()))
		default:
			requestlog.From(r.Context()).Error("reorder entries", "error", err)
			problem.Write(w, r, problem.InternalError())
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
