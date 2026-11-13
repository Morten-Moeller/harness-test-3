-- name: ListEntries :many
SELECT id, list_id, title, done, position, created_at, updated_at
FROM entries
ORDER BY list_id, position, created_at;

-- name: CreateEntry :one
INSERT INTO entries (id, list_id, title, done, position, created_at, updated_at)
VALUES (
    sqlc.arg(id),
    sqlc.arg(list_id),
    sqlc.arg(title),
    false,
    (SELECT COALESCE(MAX(position), 0) + 1 FROM entries WHERE list_id = sqlc.arg(list_id)),
    sqlc.arg(now),
    sqlc.arg(now)
)
RETURNING id;

-- name: UpdateEntry :one
UPDATE entries
SET title = COALESCE(sqlc.narg(title), title),
    done = COALESCE(sqlc.narg(done), done),
    updated_at = sqlc.arg(now)
WHERE id = sqlc.arg(id)
RETURNING id;

-- name: DeleteEntry :one
DELETE FROM entries
WHERE id = sqlc.arg(id)
RETURNING id;

-- name: DeleteAllEntries :exec
DELETE FROM entries;
