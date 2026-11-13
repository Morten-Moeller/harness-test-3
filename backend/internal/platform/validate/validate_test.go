package validate_test

import (
	"strings"
	"testing"

	"todo/internal/platform/validate"
)

func TestTitle(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		want    string
		wantErr string
	}{
		{name: "keeps a plain title", raw: "Milch", want: "Milch"},
		{name: "trims spaces", raw: "  Milch  ", want: "Milch"},
		{name: "accepts 200 characters", raw: strings.Repeat("ä", 200), want: strings.Repeat("ä", 200)},
		{name: "rejects an empty title", raw: "", wantErr: "required"},
		{name: "rejects spaces only", raw: "   ", wantErr: "required"},
		{name: "rejects 201 characters", raw: strings.Repeat("a", 201), wantErr: "longer"},
		{name: "rejects a NUL character", raw: "a\x00b", wantErr: "control"},
		{name: "rejects a line break", raw: "a\nb", wantErr: "control"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validate.Title(tc.raw)
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("want error containing %q, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("want %q, got %q", tc.want, got)
			}
		})
	}
}
