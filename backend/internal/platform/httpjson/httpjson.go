package httpjson

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const MaxBodyBytes = 1 << 16

func Decode(w http.ResponseWriter, r *http.Request, target any) error {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxBodyBytes))
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return errors.New("body is larger than 64 KiB")
	}
	if err != nil {
		return errors.New("body is not readable")
	}
	if err := json.Unmarshal(body, target); err != nil {
		return errors.New("body is not valid JSON")
	}
	return nil
}

func Write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
