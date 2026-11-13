package problem

import (
	"encoding/json"
	"net/http"
)

const ContentType = "application/problem+json"

type Code string

const (
	ValidationFailed Code = "VALIDATION_FAILED"
	NotFound         Code = "NOT_FOUND"
	Internal         Code = "INTERNAL"
)

type Problem struct {
	Type      string `json:"type"`
	Title     string `json:"title"`
	Status    int    `json:"status"`
	Detail    string `json:"detail,omitempty"`
	Instance  string `json:"instance,omitempty"`
	ErrorCode Code   `json:"errorCode"`
}

func Validation(detail string) Problem {
	return Problem{Type: "about:blank", Title: "Invalid input", Status: http.StatusBadRequest, Detail: detail, ErrorCode: ValidationFailed}
}

func Missing(detail string) Problem {
	return Problem{Type: "about:blank", Title: "Not found", Status: http.StatusNotFound, Detail: detail, ErrorCode: NotFound}
}

func InternalError() Problem {
	return Problem{Type: "about:blank", Title: "Internal error", Status: http.StatusInternalServerError, ErrorCode: Internal}
}

func Write(w http.ResponseWriter, r *http.Request, p Problem) {
	p.Instance = r.URL.Path
	w.Header().Set("Content-Type", ContentType)
	w.WriteHeader(p.Status)
	_ = json.NewEncoder(w).Encode(p)
}
