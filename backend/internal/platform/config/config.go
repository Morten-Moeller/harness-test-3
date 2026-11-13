package config

import (
	"fmt"
	"log/slog"
	"strings"
)

type Config struct {
	DatabaseURL string
	HTTPAddr    string
	LogLevel    slog.Level
}

type Lookup func(name string) (string, bool)

func Load(lookup Lookup) (Config, error) {
	var cfg Config
	var err error
	if cfg.DatabaseURL, err = required(lookup, "DATABASE_URL"); err != nil {
		return Config{}, err
	}
	if cfg.HTTPAddr, err = required(lookup, "HTTP_ADDR"); err != nil {
		return Config{}, err
	}
	level, err := required(lookup, "LOG_LEVEL")
	if err != nil {
		return Config{}, err
	}
	if err := cfg.LogLevel.UnmarshalText([]byte(strings.ToUpper(level))); err != nil {
		return Config{}, fmt.Errorf("LOG_LEVEL has an unknown value %q: use debug, info, warn or error", level)
	}
	return cfg, nil
}

func required(lookup Lookup, name string) (string, error) {
	value, ok := lookup(name)
	if !ok || strings.TrimSpace(value) == "" {
		return "", fmt.Errorf("%s is not set", name)
	}
	return value, nil
}
