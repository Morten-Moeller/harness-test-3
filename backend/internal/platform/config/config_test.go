package config_test

import (
	"log/slog"
	"strings"
	"testing"

	"todo/internal/platform/config"
)

func TestLoad(t *testing.T) {
	complete := map[string]string{
		"DATABASE_URL": "postgres://u:p@localhost:5432/db",
		"HTTP_ADDR":    "127.0.0.1:8080",
		"LOG_LEVEL":    "debug",
	}
	cases := []struct {
		name    string
		without string
		value   string
		wantErr string
	}{
		{name: "loads every variable"},
		{name: "stops with the name of a missing DATABASE_URL", without: "DATABASE_URL", wantErr: "DATABASE_URL"},
		{name: "stops with the name of a missing HTTP_ADDR", without: "HTTP_ADDR", wantErr: "HTTP_ADDR"},
		{name: "stops with the name of a missing LOG_LEVEL", without: "LOG_LEVEL", wantErr: "LOG_LEVEL"},
		{name: "stops with the name of an empty variable", without: "HTTP_ADDR", value: "  ", wantErr: "HTTP_ADDR"},
		{name: "stops on an unknown log level", without: "LOG_LEVEL", value: "loud", wantErr: "LOG_LEVEL"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := map[string]string{}
			for k, v := range complete {
				env[k] = v
			}
			if tc.without != "" {
				delete(env, tc.without)
				if tc.value != "" {
					env[tc.without] = tc.value
				}
			}
			lookup := func(name string) (string, bool) {
				v, ok := env[name]
				return v, ok
			}
			cfg, err := config.Load(lookup)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if cfg.LogLevel != slog.LevelDebug || cfg.HTTPAddr != "127.0.0.1:8080" {
					t.Fatalf("unexpected config: %+v", cfg)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("want error naming %s, got %v", tc.wantErr, err)
			}
		})
	}
}
