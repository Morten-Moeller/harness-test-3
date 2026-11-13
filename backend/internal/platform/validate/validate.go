package validate

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

const MaxTitleLength = 200

func Title(raw string) (string, error) {
	title := strings.TrimSpace(raw)
	length := utf8.RuneCountInString(title)
	if length == 0 {
		return "", errors.New("title is required")
	}
	if length > MaxTitleLength {
		return "", errors.New("title is longer than 200 characters")
	}
	if strings.ContainsFunc(title, unicode.IsControl) {
		return "", errors.New("title contains a control character")
	}
	return title, nil
}
