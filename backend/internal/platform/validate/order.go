package validate

import (
	"bytes"
	"errors"
	"fmt"
	"slices"

	"github.com/google/uuid"
)

const MaxOrderLength = 500

var ErrIncompleteOrder = errors.New("order does not contain exactly the current items")

func Order(ids []uuid.UUID, field string) error {
	if len(ids) == 0 {
		return fmt.Errorf("%s is required", field)
	}
	if len(ids) > MaxOrderLength {
		return fmt.Errorf("%s has more than %d ids", field, MaxOrderLength)
	}
	seen := make(map[uuid.UUID]struct{}, len(ids))
	for _, id := range ids {
		if _, duplicate := seen[id]; duplicate {
			return fmt.Errorf("%s contains a duplicate id", field)
		}
		seen[id] = struct{}{}
	}
	return nil
}

func LockOrder(ids []uuid.UUID) []uuid.UUID {
	sorted := slices.Clone(ids)
	slices.SortFunc(sorted, func(a, b uuid.UUID) int { return bytes.Compare(a[:], b[:]) })
	return sorted
}

func Positions(ids []uuid.UUID) map[uuid.UUID]int32 {
	positions := make(map[uuid.UUID]int32, len(ids))
	for index, id := range ids {
		positions[id] = int32(index + 1)
	}
	return positions
}
