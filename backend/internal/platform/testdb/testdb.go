package testdb

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"todo/internal/platform/db"
)

const image = "postgres:17"

func Start(ctx context.Context) (*pgxpool.Pool, func(), error) {
	healthCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	provider, err := testcontainers.NewDockerProvider()
	if err != nil {
		return nil, nil, dockerError(err)
	}
	if err := provider.Health(healthCtx); err != nil {
		return nil, nil, dockerError(err)
	}
	container, err := postgres.Run(ctx, image,
		postgres.WithDatabase("todo"),
		postgres.WithUsername("todo"),
		postgres.WithPassword("todo"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		return nil, nil, err
	}
	stop := func() { _ = container.Terminate(context.Background()) }
	url, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		stop()
		return nil, nil, err
	}
	pool, err := db.Open(ctx, url)
	if err != nil {
		stop()
		return nil, nil, err
	}
	if err := db.Migrate(ctx, pool); err != nil {
		pool.Close()
		stop()
		return nil, nil, err
	}
	return pool, func() { pool.Close(); stop() }, nil
}

func MustStart(m *testing.M) (*pgxpool.Pool, func()) {
	pool, stop, err := Start(context.Background())
	if err != nil {
		panic(err)
	}
	return pool, stop
}

type DockerError struct{ cause error }

func (e DockerError) Error() string {
	return "Docker is not reachable: " + e.cause.Error() + ". Start Docker and run make test again."
}

func (e DockerError) Unwrap() error { return e.cause }

func dockerError(err error) error { return DockerError{cause: err} }
