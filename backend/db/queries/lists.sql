-- name: ListLists :many
SELECT id, title, position, created_at, updated_at
FROM lists
ORDER BY position, created_at;

-- name: CreateList :one
INSERT INTO lists (id, title, position, created_at, updated_at)
VALUES (
    sqlc.arg(id),
    sqlc.arg(title),
    (SELECT COALESCE(MAX(position), 0) + 1 FROM lists),
    sqlc.arg(now),
    sqlc.arg(now)
)
RETURNING id;

-- name: DeleteAllLists :exec
DELETE FROM lists;
