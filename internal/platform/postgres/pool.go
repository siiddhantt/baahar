package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PoolConfig struct {
	URL              string
	MaximumOpenConns int32
	StatementTimeout time.Duration
}

func Open(ctx context.Context, config PoolConfig) (*pgxpool.Pool, error) {
	if config.URL == "" {
		return nil, errors.New("database URL is required")
	}
	poolConfig, err := pgxpool.ParseConfig(config.URL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}
	if config.MaximumOpenConns > 0 {
		poolConfig.MaxConns = config.MaximumOpenConns
	}
	if config.StatementTimeout > 0 {
		poolConfig.ConnConfig.RuntimeParams["statement_timeout"] = fmt.Sprintf("%d", config.StatementTimeout.Milliseconds())
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("open database pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}
