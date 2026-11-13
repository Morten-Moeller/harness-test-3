package lists_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"todo/internal/api"
	"todo/internal/entries"
	"todo/internal/lists"
	"todo/internal/platform/problem"
	"todo/internal/platform/server"
	"todo/internal/platform/testdb"
	"todo/internal/store"
)

var pool *pgxpool.Pool

type listsAPI = lists.Handler

type entriesAPI = entries.Handler

type handlers struct {
	*listsAPI
	*entriesAPI
}

func TestMain(m *testing.M) {
	var stop func()
	pool, stop = testdb.MustStart(m)
	code := m.Run()
	stop()
	os.Exit(code)
}

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := httptest.NewServer(server.New(logger, handlers{lists.New(pool), entries.New(pool)}))
	t.Cleanup(srv.Close)
	return srv
}

func postList(t *testing.T, srv *httptest.Server, body string) *http.Response {
	t.Helper()
	res, err := http.Post(srv.URL+"/api/lists", "application/json", bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })
	return res
}

func getLists(t *testing.T, srv *httptest.Server) api.ListPage {
	t.Helper()
	res, err := http.Get(srv.URL + "/api/lists")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", res.StatusCode)
	}
	var page api.ListPage
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return page
}

func call(t *testing.T, srv *httptest.Server, method, path, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	t.Cleanup(func() { _ = res.Body.Close() })
	return res
}

func createList(t *testing.T, srv *httptest.Server, title string) uuid.UUID {
	t.Helper()
	res := postList(t, srv, fmt.Sprintf(`{"title": %q}`, title))
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201, got %d", res.StatusCode)
	}
	var created api.Created
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return created.Id
}

func findList(t *testing.T, srv *httptest.Server, id uuid.UUID) (api.List, bool) {
	t.Helper()
	for _, item := range getLists(t, srv).Items {
		if item.Id == id {
			return item, true
		}
	}
	return api.List{}, false
}

func createEntry(t *testing.T, srv *httptest.Server, listID uuid.UUID, title string) uuid.UUID {
	t.Helper()
	res := call(t, srv, http.MethodPost, "/api/lists/"+listID.String()+"/entries", fmt.Sprintf(`{"title": %q}`, title))
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201, got %d", res.StatusCode)
	}
	var created api.Created
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return created.Id
}

func entryIDsOf(t *testing.T, srv *httptest.Server, listID uuid.UUID) []uuid.UUID {
	t.Helper()
	res := call(t, srv, http.MethodGet, "/api/entries", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", res.StatusCode)
	}
	var page api.EntryPage
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
		t.Fatalf("decode: %v", err)
	}
	var ids []uuid.UUID
	for _, item := range page.Items {
		if item.ListId == listID {
			ids = append(ids, item.Id)
		}
	}
	return ids
}

func uniqueTitle(t *testing.T, prefix string) string {
	return fmt.Sprintf("%s %s %s", prefix, t.Name(), uuid.NewString()[:8])
}

func TestListsListsInPositionOrder(t *testing.T) {
	srv := newServer(t)
	first := uniqueTitle(t, "first")
	second := uniqueTitle(t, "second")
	postList(t, srv, fmt.Sprintf(`{"title": %q}`, first))
	postList(t, srv, fmt.Sprintf(`{"title": %q}`, second))

	page := getLists(t, srv)

	firstIndex, secondIndex := -1, -1
	var firstPosition, secondPosition int32
	for i, item := range page.Items {
		switch item.Title {
		case first:
			firstIndex, firstPosition = i, item.Position
		case second:
			secondIndex, secondPosition = i, item.Position
		}
	}
	if firstIndex < 0 || secondIndex < 0 {
		t.Fatalf("created lists missing in %+v", page.Items)
	}
	if firstIndex > secondIndex || firstPosition >= secondPosition {
		t.Fatalf("want %q before %q, got indexes %d and %d, positions %d and %d", first, second, firstIndex, secondIndex, firstPosition, secondPosition)
	}
}

func TestCreatesAListAndReturnsItsId(t *testing.T) {
	srv := newServer(t)
	title := uniqueTitle(t, "Einkauf")

	res := postList(t, srv, fmt.Sprintf(`{"title": %q}`, title))

	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201, got %d", res.StatusCode)
	}
	var created api.Created
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.Id.Version() != 7 {
		t.Fatalf("want a UUIDv7, got version %d (%s)", created.Id.Version(), created.Id)
	}
	rows, err := store.New(pool).ListLists(context.Background())
	if err != nil {
		t.Fatalf("read rows: %v", err)
	}
	var row *store.List
	for i := range rows {
		if rows[i].ID == created.Id {
			row = &rows[i]
		}
	}
	if row == nil {
		t.Fatalf("row %s not stored", created.Id)
	}
	if row.Title != title {
		t.Fatalf("want title %q, got %q", title, row.Title)
	}
	if row.CreatedAt.IsZero() || !row.CreatedAt.Equal(row.UpdatedAt) {
		t.Fatalf("want created_at equal to updated_at, got %v and %v", row.CreatedAt, row.UpdatedAt)
	}
	if time.Since(row.CreatedAt) > time.Minute {
		t.Fatalf("created_at %v is not now", row.CreatedAt)
	}
}

func TestRejectsAnEmptyTitleWithValidationFailed(t *testing.T) {
	srv := newServer(t)

	res := postList(t, srv, `{"title": ""}`)

	assertValidationFailed(t, res)
}

func TestRejectsATitleOver200Characters(t *testing.T) {
	srv := newServer(t)
	title := strings.Repeat("ä", 201)

	res := postList(t, srv, fmt.Sprintf(`{"title": %q}`, title))

	assertValidationFailed(t, res)
	page := getLists(t, srv)
	for _, item := range page.Items {
		if item.Title == title {
			t.Fatalf("rejected list was stored")
		}
	}
}

func TestAcceptsATitleOfExactly200Characters(t *testing.T) {
	srv := newServer(t)
	title := strings.Repeat("ä", 192) + uuid.NewString()[:8]

	res := postList(t, srv, fmt.Sprintf(`{"title": %q}`, title))

	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201 for 200 characters, got %d", res.StatusCode)
	}
}

func TestRejectsInvalidTitles(t *testing.T) {
	srv := newServer(t)
	cases := []struct {
		name string
		body string
	}{
		{name: "rejects a title of spaces only", body: `{"title": "   "}`},
		{name: "rejects a missing title field", body: `{}`},
		{name: "rejects a title with a NUL character", body: `{"title": "a\u0000b"}`},
		{name: "rejects a title with a line break", body: `{"title": "a\nb"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := postList(t, srv, tc.body)
			assertValidationFailed(t, res)
		})
	}
}

func TestStoresTheTrimmedTitle(t *testing.T) {
	srv := newServer(t)
	title := uniqueTitle(t, "trimmed")

	res := postList(t, srv, fmt.Sprintf(`{"title": %q}`, "  "+title+"  "))

	if res.StatusCode != http.StatusCreated {
		t.Fatalf("want 201, got %d", res.StatusCode)
	}
	found := false
	for _, item := range getLists(t, srv).Items {
		if item.Title == title {
			found = true
		}
	}
	if !found {
		t.Fatalf("trimmed title %q not stored", title)
	}
}

func TestReturnsTimesInUTC(t *testing.T) {
	srv := newServer(t)
	title := uniqueTitle(t, "utc")
	postList(t, srv, fmt.Sprintf(`{"title": %q}`, title))

	res, err := http.Get(srv.URL + "/api/lists")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer func() { _ = res.Body.Close() }()
	var page struct {
		Items []struct {
			Title     string `json:"title"`
			CreatedAt string `json:"createdAt"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
		t.Fatalf("decode: %v", err)
	}
	found := false
	for _, item := range page.Items {
		if item.Title != title {
			continue
		}
		found = true
		if !strings.HasSuffix(item.CreatedAt, "Z") {
			t.Fatalf("want createdAt in UTC with suffix Z, got %s", item.CreatedAt)
		}
	}
	if !found {
		t.Fatalf("list %q not returned", title)
	}
}

func TestRejectsABodyOver64KiB(t *testing.T) {
	srv := newServer(t)
	body := fmt.Sprintf(`{"title": %q}`, strings.Repeat("a", 70*1024))

	res := postList(t, srv, body)

	assertValidationFailed(t, res)
}

func TestRejectsABodyThatIsNotJSON(t *testing.T) {
	srv := newServer(t)

	res := postList(t, srv, `{"title": `)

	assertValidationFailed(t, res)
}

func TestRenamesAListAndKeepsPositionAndCreatedAt(t *testing.T) {
	srv := newServer(t)
	id := createList(t, srv, uniqueTitle(t, "Einkauf"))
	before, _ := findList(t, srv, id)
	newTitle := uniqueTitle(t, "Wochenmarkt")

	res := call(t, srv, http.MethodPatch, "/api/lists/"+id.String(), fmt.Sprintf(`{"title": %q}`, "  "+newTitle+"  "))

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	after, found := findList(t, srv, id)
	if !found || after.Title != newTitle {
		t.Fatalf("want trimmed title %q, got %+v", newTitle, after)
	}
	if after.Position != before.Position || !after.CreatedAt.Equal(before.CreatedAt) {
		t.Fatalf("want unchanged position and created_at, got %+v then %+v", before, after)
	}
	if !after.UpdatedAt.After(before.UpdatedAt) {
		t.Fatalf("want later updated_at, got %v then %v", before.UpdatedAt, after.UpdatedAt)
	}
}

func TestRejectsInvalidListTitles(t *testing.T) {
	srv := newServer(t)
	title := uniqueTitle(t, "unchanged")
	id := createList(t, srv, title)
	cases := []struct {
		name string
		body string
	}{
		{name: "rejects an empty title", body: `{"title": ""}`},
		{name: "rejects spaces only", body: `{"title": "   "}`},
		{name: "rejects 201 characters", body: fmt.Sprintf(`{"title": %q}`, strings.Repeat("ä", 201))},
		{name: "rejects a NUL character", body: `{"title": "a\u0000b"}`},
		{name: "rejects a line break", body: `{"title": "a\nb"}`},
		{name: "rejects a missing title field", body: `{}`},
		{name: "rejects a body that is not JSON", body: `{"title": `},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := call(t, srv, http.MethodPatch, "/api/lists/"+id.String(), tc.body)
			assertValidationFailed(t, res)
		})
	}
	if after, _ := findList(t, srv, id); after.Title != title {
		t.Fatalf("rejected update changed the list: %+v", after)
	}
}

func TestAnswers404WhenRenamingAnUnknownList(t *testing.T) {
	srv := newServer(t)

	res := call(t, srv, http.MethodPatch, "/api/lists/"+uuid.NewString(), `{"title": "Wochenmarkt"}`)

	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
}

func TestDeletesAListWithItsEntriesAndAnswers404Afterwards(t *testing.T) {
	srv := newServer(t)
	id := createList(t, srv, uniqueTitle(t, "Einkauf"))
	createEntry(t, srv, id, "Milch")
	createEntry(t, srv, id, "Brot")
	otherID := createList(t, srv, uniqueTitle(t, "Arbeit"))
	otherEntry := createEntry(t, srv, otherID, "Bericht")

	res := call(t, srv, http.MethodDelete, "/api/lists/"+id.String(), "")

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	if _, found := findList(t, srv, id); found {
		t.Fatalf("list %s still stored", id)
	}
	if got := entryIDsOf(t, srv, id); len(got) != 0 {
		t.Fatalf("entries of the deleted list still stored: %v", got)
	}
	if got := entryIDsOf(t, srv, otherID); len(got) != 1 || got[0] != otherEntry {
		t.Fatalf("want entry %s of the other list kept, got %v", otherEntry, got)
	}
	res = call(t, srv, http.MethodDelete, "/api/lists/"+id.String(), "")
	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
}

func assertValidationFailed(t *testing.T, res *http.Response) {
	t.Helper()
	assertProblem(t, res, http.StatusBadRequest, problem.ValidationFailed)
}

func assertProblem(t *testing.T, res *http.Response, status int, code problem.Code) {
	t.Helper()
	if res.StatusCode != status {
		t.Fatalf("want %d, got %d", status, res.StatusCode)
	}
	if ct := res.Header.Get("Content-Type"); ct != problem.ContentType {
		t.Fatalf("want content type %s, got %s", problem.ContentType, ct)
	}
	var p problem.Problem
	if err := json.NewDecoder(res.Body).Decode(&p); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if p.ErrorCode != code || p.Status != status {
		t.Fatalf("want %s %d, got %+v", code, status, p)
	}
}
