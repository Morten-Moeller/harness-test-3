package main

import (
	"context"
	"encoding/json"
	"errors"
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
		return withLists(ctx, pool)
	default:
		return fail("UNKNOWN_STATE", fmt.Sprintf("state %q is not known", state), "use --state empty or --state with-lists")
	}
}

func empty(ctx context.Context, pool *pgxpool.Pool) result {
	if err := store.New(pool).DeleteAllLists(ctx); err != nil {
		return fail("DB_ERROR", err.Error(), "")
	}
	return result{Ok: true, Data: map[string]any{"state": "empty", "lists": []any{}}}
}

func withLists(ctx context.Context, pool *pgxpool.Pool) result {
	queries := store.New(pool)
	if err := queries.DeleteAllLists(ctx); err != nil {
		return fail("DB_ERROR", err.Error(), "")
	}
	now := time.Now().UTC()
	created := make([]map[string]string, 0, len(titles))
	for _, title := range titles {
		id, err := queries.CreateList(ctx, store.CreateListParams{ID: uuid.Must(uuid.NewV7()), Title: title, Now: now})
		if err != nil {
			return fail("DB_ERROR", err.Error(), "")
		}
		created = append(created, map[string]string{"id": id.String(), "title": title})
	}
	return result{Ok: true, Data: map[string]any{"state": "with-lists", "lists": created}}
}

func fail(code, message, fix string) result {
	if errors.Is(context.Cause(context.Background()), context.DeadlineExceeded) {
		message = "timeout: " + message
	}
	return result{Ok: false, Error: &resultError{Code: code, Message: message, Fix: fix}}
}
