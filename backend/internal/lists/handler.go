package lists

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"todo/internal/api"
	"todo/internal/platform/problem"
	"todo/internal/platform/requestlog"
	"todo/internal/store"
)

const maxTitleLength = 200

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
			CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt,
		})
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handler) CreateList(w http.ResponseWriter, r *http.Request) {
	var body api.CreateList
	if err := decode(r, &body); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	if err := validateTitle(body.Title); err != nil {
		problem.Write(w, r, problem.Validation(err.Error()))
		return
	}
	id, err := h.queries.CreateList(r.Context(), store.CreateListParams{
		ID:    uuid.Must(uuid.NewV7()),
		Title: body.Title,
		Now:   h.now(),
	})
	if err != nil {
		requestlog.From(r.Context()).Error("create list", "error", err)
		problem.Write(w, r, problem.InternalError())
		return
	}
	writeJSON(w, http.StatusCreated, api.Created{Id: id})
}

func validateTitle(title string) error {
	length := utf8.RuneCountInString(title)
	if length == 0 {
		return errors.New("title is required")
	}
	if length > maxTitleLength {
		return errors.New("title is longer than 200 characters")
	}
	return nil
}

func decode(r *http.Request, target any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err != nil {
		return errors.New("body is not readable")
	}
	if err := json.Unmarshal(body, target); err != nil {
		return errors.New("body is not valid JSON")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
