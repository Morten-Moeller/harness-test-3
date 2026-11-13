-- +goose Up
CREATE TABLE lists (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    position integer NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE INDEX lists_position_idx ON lists (position);

-- +goose Down
DROP TABLE lists;
