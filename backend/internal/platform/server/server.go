package server

import (
	"log/slog"
	"net/http"

	"todo/internal/api"
	"todo/internal/platform/problem"
	"todo/internal/platform/requestlog"
)

func New(logger *slog.Logger, handlers api.ServerInterface) http.Handler {
	mux := http.NewServeMux()
	routed := api.HandlerWithOptions(handlers, api.StdHTTPServerOptions{
		BaseRouter: mux,
		ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			problem.Write(w, r, problem.Validation(err.Error()))
		},
	})
	return requestlog.Middleware(logger)(routed)
}
