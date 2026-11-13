-- +goose Up
CREATE TABLE entries (
    id uuid PRIMARY KEY,
    list_id uuid NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    title text NOT NULL,
    done boolean NOT NULL DEFAULT false,
    position integer NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE INDEX entries_list_position_idx ON entries (list_id, position);

-- +goose Down
DROP TABLE entries;
