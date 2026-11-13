package requestlog

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type loggerKey struct{}

const (
	Header      = "X-Request-Id"
	maxIDLength = 64
)

func Middleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get(Header)
			if id == "" || len(id) > maxIDLength {
				id = uuid.Must(uuid.NewV7()).String()
			}
			w.Header().Set(Header, id)
			requestLogger := logger.With("requestId", id)
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			start := time.Now()
			next.ServeHTTP(recorder, r.WithContext(context.WithValue(r.Context(), loggerKey{}, requestLogger)))
			requestLogger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.status,
				"durationMs", time.Since(start).Milliseconds(),
			)
		})
	}
}

func From(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok {
		return logger
	}
	return slog.Default()
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}
