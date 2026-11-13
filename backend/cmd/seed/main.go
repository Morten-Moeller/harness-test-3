package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"todo/internal/platform/db"
	"todo/internal/store"
)

type result struct {
	Ok    bool         `json:"ok"`
	Data  any          `json:"data,omitempty"`
	Error *resultError `json:"error,omitempty"`
}

type resultError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Fix     string `json:"fix,omitempty"`
}

var titles = []string{"Einkauf", "Arbeit", "Haushalt"}

var entryTitles = map[string][]string{
	"Einkauf":  {"Milch", "Brot", "Äpfel"},
	"Arbeit":   {"Bericht schreiben", "Rechnung prüfen", "Termin planen"},
	"Haushalt": {"Staubsaugen", "Wäsche waschen", "Blumen gießen"},
}

func main() {
	state := flag.String("state", "", "test data state: empty or with-lists")
	doctor := flag.Bool("doctor", false, "check the database and the migrations")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	res := run(ctx, *state, *doctor)
	enc := json.NewEncoder(os.Stdout)
	_ = enc.Encode(res)
	if !res.Ok {
		os.Exit(1)
	}
}

func run(ctx context.Context, state string, doctor bool) result {
	url, ok := os.LookupEnv("DATABASE_URL")
	if !ok || url == "" {
		return fail("CONFIG_MISSING", "DATABASE_URL is not set", "run through make seed or export DATABASE_URL")
	}
	pool, err := db.Open(ctx, url)
	if err != nil {
		return fail("DB_UNREACHABLE", err.Error(), "start the database: docker compose up -d --wait db")
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		return fail("MIGRATION_FAILED", err.Error(), "check backend/db/migrations and the database logs")
	}
	if doctor {
		return result{Ok: true, Data: map[string]any{"database": "reachable", "migrations": "applied"}}
	}
	switch state {
	case "empty":
		return empty(ctx, pool)
	case "with-lists":
		return withLists(ctx, pool, false)
	case "with-entries":
		return withLists(ctx, pool, true)
	default:
		return fail("UNKNOWN_STATE", fmt.Sprintf("state %q is not known", state), "use --state empty, --state with-lists or --state with-entries")
	}
}

func clear(ctx context.Context, queries *store.Queries) error {
	if err := queries.DeleteAllEntries(ctx); err != nil {
		return err
	}
	return queries.DeleteAllLists(ctx)
}

func empty(ctx context.Context, pool *pgxpool.Pool) result {
	if err := clear(ctx, store.New(pool)); err != nil {
		return fail("DB_ERROR", err.Error(), "")
	}
	return result{Ok: true, Data: map[string]any{"state": "empty", "lists": []any{}}}
}

type seededEntry struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

type seededList struct {
	ID      string        `json:"id"`
	Title   string        `json:"title"`
	Entries []seededEntry `json:"entries"`
}

func withLists(ctx context.Context, pool *pgxpool.Pool, withEntries bool) result {
	queries := store.New(pool)
	if err := clear(ctx, queries); err != nil {
		return fail("DB_ERROR", err.Error(), "")
	}
	now := time.Now().UTC()
	created := make([]seededList, 0, len(titles))
	for _, title := range titles {
		id, err := queries.CreateList(ctx, store.CreateListParams{ID: uuid.Must(uuid.NewV7()), Title: title, Now: now})
		if err != nil {
			return fail("DB_ERROR", err.Error(), "")
		}
		list := seededList{ID: id.String(), Title: title, Entries: []seededEntry{}}
		if withEntries {
			for i, entryTitle := range entryTitles[title] {
				entryID, err := queries.CreateEntry(ctx, store.CreateEntryParams{ID: uuid.Must(uuid.NewV7()), ListID: id, Title: entryTitle, Now: now})
				if err != nil {
					return fail("DB_ERROR", err.Error(), "")
				}
				done := i == 0
				if done {
					if _, err := queries.UpdateEntry(ctx, store.UpdateEntryParams{ID: entryID, Done: &done, Now: now}); err != nil {
						return fail("DB_ERROR", err.Error(), "")
					}
				}
				list.Entries = append(list.Entries, seededEntry{ID: entryID.String(), Title: entryTitle, Done: done})
			}
		}
		created = append(created, list)
	}
	state := "with-lists"
	if withEntries {
		state = "with-entries"
	}
	return result{Ok: true, Data: map[string]any{"state": state, "lists": created}}
}

func fail(code, message, fix string) result {
	return result{Ok: false, Error: &resultError{Code: code, Message: message, Fix: fix}}
}
