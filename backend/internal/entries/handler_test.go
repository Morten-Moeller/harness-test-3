package entries_test

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

func createList(t *testing.T) uuid.UUID {
	t.Helper()
	id, err := store.New(pool).CreateList(context.Background(), store.CreateListParams{
		ID:    uuid.Must(uuid.NewV7()),
		Title: fmt.Sprintf("list %s %s", t.Name(), uuid.NewString()[:8]),
		Now:   time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("create list: %v", err)
	}
	return id
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

func entriesOf(t *testing.T, srv *httptest.Server, listID uuid.UUID) []api.Entry {
	t.Helper()
	res := call(t, srv, http.MethodGet, "/api/entries", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", res.StatusCode)
	}
	var page api.EntryPage
	if err := json.NewDecoder(res.Body).Decode(&page); err != nil {
		t.Fatalf("decode: %v", err)
	}
	var mine []api.Entry
	for _, item := range page.Items {
		if item.ListId == listID {
			mine = append(mine, item)
		}
	}
	return mine
}

func findEntry(t *testing.T, srv *httptest.Server, listID, entryID uuid.UUID) api.Entry {
	t.Helper()
	for _, item := range entriesOf(t, srv, listID) {
		if item.Id == entryID {
			return item
		}
	}
	t.Fatalf("entry %s not found", entryID)
	return api.Entry{}
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
	if p.ErrorCode != code {
		t.Fatalf("want errorCode %s, got %+v", code, p)
	}
}

func TestListsEntriesOfAListInPositionOrder(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	first := createEntry(t, srv, listID, "first")
	second := createEntry(t, srv, listID, "second")

	mine := entriesOf(t, srv, listID)

	if len(mine) != 2 || mine[0].Id != first || mine[1].Id != second {
		t.Fatalf("want [%s %s], got %+v", first, second, mine)
	}
	if mine[0].Position >= mine[1].Position {
		t.Fatalf("want ascending positions, got %d and %d", mine[0].Position, mine[1].Position)
	}
	if mine[0].Done || mine[0].Title != "first" || mine[0].ListId != listID {
		t.Fatalf("unexpected entry %+v", mine[0])
	}
}

func TestCreatesAnEntryWithTheNextPosition(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	otherListID := createList(t)
	createEntry(t, srv, otherListID, "other")
	createEntry(t, srv, listID, "one")

	id := createEntry(t, srv, listID, "  two  ")

	entry := findEntry(t, srv, listID, id)
	if entry.Position != 2 || entry.Title != "two" || entry.Done {
		t.Fatalf("want position 2, trimmed title and open, got %+v", entry)
	}
	if id.Version() != 7 {
		t.Fatalf("want a UUIDv7, got version %d", id.Version())
	}
}

func TestAnswers404ForAnUnknownList(t *testing.T) {
	srv := newServer(t)

	res := call(t, srv, http.MethodPost, "/api/lists/"+uuid.NewString()+"/entries", `{"title": "x"}`)

	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
}

func TestRejectsInvalidEntryTitles(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	cases := []struct {
		name string
		body string
	}{
		{name: "rejects an empty title", body: `{"title": ""}`},
		{name: "rejects spaces only", body: `{"title": "   "}`},
		{name: "rejects 201 characters", body: fmt.Sprintf(`{"title": %q}`, strings.Repeat("a", 201))},
		{name: "rejects a NUL character", body: `{"title": "a\u0000b"}`},
		{name: "rejects a body that is not JSON", body: `{"title": `},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := call(t, srv, http.MethodPost, "/api/lists/"+listID.String()+"/entries", tc.body)
			assertProblem(t, res, http.StatusBadRequest, problem.ValidationFailed)
		})
	}
	if got := entriesOf(t, srv, listID); len(got) != 0 {
		t.Fatalf("rejected entries were stored: %+v", got)
	}
}

func TestMarksAnEntryAsDone(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	id := createEntry(t, srv, listID, "Milch")
	before := findEntry(t, srv, listID, id)

	res := call(t, srv, http.MethodPatch, "/api/entries/"+id.String(), `{"done": true}`)

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	after := findEntry(t, srv, listID, id)
	if !after.Done || after.Title != "Milch" {
		t.Fatalf("want done with unchanged title, got %+v", after)
	}
	if !after.CreatedAt.Equal(before.CreatedAt) || !after.UpdatedAt.After(before.UpdatedAt) {
		t.Fatalf("want unchanged created_at and later updated_at, got %+v then %+v", before, after)
	}
	res = call(t, srv, http.MethodPatch, "/api/entries/"+id.String(), `{"done": false}`)
	if res.StatusCode != http.StatusNoContent || findEntry(t, srv, listID, id).Done {
		t.Fatalf("want entry open again")
	}
}

func TestChangesTheTitle(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	id := createEntry(t, srv, listID, "Milch")
	call(t, srv, http.MethodPatch, "/api/entries/"+id.String(), `{"done": true}`)

	res := call(t, srv, http.MethodPatch, "/api/entries/"+id.String(), `{"title": " Hafermilch "}`)

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	after := findEntry(t, srv, listID, id)
	if after.Title != "Hafermilch" || !after.Done {
		t.Fatalf("want new title and done kept, got %+v", after)
	}
}

func TestChangesTitleAndDoneAtOnce(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	id := createEntry(t, srv, listID, "Milch")

	res := call(t, srv, http.MethodPatch, "/api/entries/"+id.String(), `{"title": "Brot", "done": true}`)

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	after := findEntry(t, srv, listID, id)
	if after.Title != "Brot" || !after.Done {
		t.Fatalf("want Brot and done, got %+v", after)
	}
}

func TestRejectsAnUpdateWithoutFields(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	id := createEntry(t, srv, listID, "Milch")
	cases := []struct {
		name string
		body string
	}{
		{name: "rejects a body without fields", body: `{}`},
		{name: "rejects an empty title", body: `{"title": ""}`},
		{name: "rejects a body that is not JSON", body: `{"done": `},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := call(t, srv, http.MethodPatch, "/api/entries/"+id.String(), tc.body)
			assertProblem(t, res, http.StatusBadRequest, problem.ValidationFailed)
		})
	}
	if after := findEntry(t, srv, listID, id); after.Title != "Milch" || after.Done {
		t.Fatalf("rejected update changed the entry: %+v", after)
	}
}

func TestAnswers404ForAnUnknownEntry(t *testing.T) {
	srv := newServer(t)

	res := call(t, srv, http.MethodPatch, "/api/entries/"+uuid.NewString(), `{"done": true}`)

	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
}

func TestDeletesAnEntryAndAnswers404Afterwards(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	id := createEntry(t, srv, listID, "Milch")

	res := call(t, srv, http.MethodDelete, "/api/entries/"+id.String(), "")

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	if got := entriesOf(t, srv, listID); len(got) != 0 {
		t.Fatalf("entry still stored: %+v", got)
	}
	res = call(t, srv, http.MethodDelete, "/api/entries/"+id.String(), "")
	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
}

func TestDeletingAListRemovesItsEntries(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	createEntry(t, srv, listID, "Milch")
	createEntry(t, srv, listID, "Brot")

	tag, err := pool.Exec(context.Background(), "DELETE FROM lists WHERE id = $1", listID)
	if err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("delete list: %v, rows %d", err, tag.RowsAffected())
	}

	if got := entriesOf(t, srv, listID); len(got) != 0 {
		t.Fatalf("entries of the deleted list still stored: %+v", got)
	}
}

func orderBody(ids ...uuid.UUID) string {
	quoted := make([]string, 0, len(ids))
	for _, id := range ids {
		quoted = append(quoted, fmt.Sprintf("%q", id.String()))
	}
	return fmt.Sprintf(`{"entryIds": [%s]}`, strings.Join(quoted, ", "))
}

func reorder(t *testing.T, srv *httptest.Server, listID uuid.UUID, body string) *http.Response {
	t.Helper()
	return call(t, srv, http.MethodPut, "/api/lists/"+listID.String()+"/entries/order", body)
}

func idsOf(entries []api.Entry) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(entries))
	for _, entry := range entries {
		ids = append(ids, entry.Id)
	}
	return ids
}

func TestReordersTheEntriesOfAList(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	a := createEntry(t, srv, listID, "a")
	b := createEntry(t, srv, listID, "b")
	c := createEntry(t, srv, listID, "c")
	before := findEntry(t, srv, listID, c)

	res := reorder(t, srv, listID, orderBody(c, a, b))

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	mine := entriesOf(t, srv, listID)
	if got := idsOf(mine); len(got) != 3 || got[0] != c || got[1] != a || got[2] != b {
		t.Fatalf("want order [c a b], got %v", got)
	}
	for i, entry := range mine {
		if entry.Position != int32(i+1) {
			t.Fatalf("want position %d for %s, got %d", i+1, entry.Title, entry.Position)
		}
	}
	if !mine[0].UpdatedAt.After(before.UpdatedAt) {
		t.Fatalf("want a later updated_at, got %v then %v", before.UpdatedAt, mine[0].UpdatedAt)
	}
}

func TestMovesAnEntryIntoAnotherListAtTheGivenIndex(t *testing.T) {
	srv := newServer(t)
	source := createList(t)
	target := createList(t)
	s1 := createEntry(t, srv, source, "s1")
	s2 := createEntry(t, srv, source, "s2")
	s3 := createEntry(t, srv, source, "s3")
	t1 := createEntry(t, srv, target, "t1")
	t2 := createEntry(t, srv, target, "t2")

	res := reorder(t, srv, target, orderBody(t1, s2, t2))

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	if got := idsOf(entriesOf(t, srv, target)); len(got) != 3 || got[0] != t1 || got[1] != s2 || got[2] != t2 {
		t.Fatalf("want target order [t1 s2 t2], got %v", got)
	}
	moved := findEntry(t, srv, target, s2)
	if moved.ListId != target || moved.Position != 2 {
		t.Fatalf("want s2 in target at position 2, got %+v", moved)
	}
	if got := idsOf(entriesOf(t, srv, source)); len(got) != 2 || got[0] != s1 || got[1] != s3 {
		t.Fatalf("want source order [s1 s3], got %v", got)
	}
}

func TestMovesAnEntryIntoAnEmptyList(t *testing.T) {
	srv := newServer(t)
	source := createList(t)
	target := createList(t)
	id := createEntry(t, srv, source, "alone")

	res := reorder(t, srv, target, orderBody(id))

	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", res.StatusCode)
	}
	moved := findEntry(t, srv, target, id)
	if moved.Position != 1 {
		t.Fatalf("want position 1, got %+v", moved)
	}
	if got := entriesOf(t, srv, source); len(got) != 0 {
		t.Fatalf("source still has entries: %+v", got)
	}
}

func TestAnswers404ForAnUnknownEntryIdAndChangesNothing(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	a := createEntry(t, srv, listID, "a")
	b := createEntry(t, srv, listID, "b")

	res := reorder(t, srv, listID, orderBody(b, uuid.New(), a))

	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
	if got := idsOf(entriesOf(t, srv, listID)); len(got) != 2 || got[0] != a || got[1] != b {
		t.Fatalf("order changed although the request failed: %v", got)
	}
}

func TestAnswers404ForAnUnknownListInReorder(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	a := createEntry(t, srv, listID, "a")

	res := reorder(t, srv, uuid.New(), orderBody(a))

	assertProblem(t, res, http.StatusNotFound, problem.NotFound)
	if after := findEntry(t, srv, listID, a); after.ListId != listID {
		t.Fatalf("entry moved although the list does not exist: %+v", after)
	}
}

func TestRejectsAnEmptyOrDuplicateOrder(t *testing.T) {
	srv := newServer(t)
	listID := createList(t)
	a := createEntry(t, srv, listID, "a")
	cases := []struct {
		name string
		body string
	}{
		{name: "rejects an empty order", body: `{"entryIds": []}`},
		{name: "rejects a missing field", body: `{}`},
		{name: "rejects duplicate ids", body: orderBody(a, a)},
		{name: "rejects an id that is not a uuid", body: `{"entryIds": ["nope"]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := reorder(t, srv, listID, tc.body)
			assertProblem(t, res, http.StatusBadRequest, problem.ValidationFailed)
		})
	}
}
