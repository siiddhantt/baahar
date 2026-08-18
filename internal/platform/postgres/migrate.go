package postgres

import (
	"context"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const migrationLockID int64 = 4_242_019_026

var migrationName = regexp.MustCompile(`^(\d{6})_([a-z0-9_]+)\.(up|down)\.sql$`)

type Migration struct {
	Version int64
	Name    string
	Up      string
	Down    string
}

func ReadMigrations(files fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(files, ".")
	if err != nil {
		return nil, fmt.Errorf("read migrations: %w", err)
	}
	byVersion := make(map[int64]*Migration)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		matches := migrationName.FindStringSubmatch(entry.Name())
		if matches == nil {
			continue
		}
		version, err := strconv.ParseInt(matches[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("parse migration %s: %w", entry.Name(), err)
		}
		content, err := fs.ReadFile(files, entry.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		migration := byVersion[version]
		if migration == nil {
			migration = &Migration{Version: version, Name: matches[2]}
			byVersion[version] = migration
		}
		if matches[3] == "up" {
			migration.Up = string(content)
		} else {
			migration.Down = string(content)
		}
	}

	migrations := make([]Migration, 0, len(byVersion))
	for _, migration := range byVersion {
		if migration.Up == "" || migration.Down == "" {
			return nil, fmt.Errorf("migration %06d requires both up and down files", migration.Version)
		}
		migrations = append(migrations, *migration)
	}
	sort.Slice(migrations, func(left, right int) bool {
		return migrations[left].Version < migrations[right].Version
	})
	return migrations, nil
}

func MigrateUp(ctx context.Context, pool *pgxpool.Pool, migrations []Migration) error {
	return withMigrationLock(ctx, pool, func(connection *pgxpool.Conn) error {
		if err := ensureMigrationTable(ctx, connection); err != nil {
			return err
		}
		applied, err := appliedVersions(ctx, connection)
		if err != nil {
			return err
		}
		for _, migration := range migrations {
			if applied[migration.Version] {
				continue
			}
			if err := applyMigration(ctx, connection, migration, true); err != nil {
				return err
			}
		}
		return nil
	})
}

func MigrateDown(ctx context.Context, pool *pgxpool.Pool, migrations []Migration) error {
	return withMigrationLock(ctx, pool, func(connection *pgxpool.Conn) error {
		if err := ensureMigrationTable(ctx, connection); err != nil {
			return err
		}
		var current int64
		err := connection.QueryRow(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&current)
		if err != nil {
			return fmt.Errorf("read current migration: %w", err)
		}
		if current == 0 {
			return nil
		}
		for _, migration := range migrations {
			if migration.Version == current {
				return applyMigration(ctx, connection, migration, false)
			}
		}
		return fmt.Errorf("down migration %06d is missing", current)
	})
}

func MigrationVersion(ctx context.Context, pool *pgxpool.Pool) (int64, error) {
	if err := ensureMigrationTable(ctx, pool); err != nil {
		return 0, err
	}
	var version int64
	if err := pool.QueryRow(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&version); err != nil {
		return 0, fmt.Errorf("read migration version: %w", err)
	}
	return version, nil
}

func ensureMigrationTable(ctx context.Context, executor interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}) error {
	_, err := executor.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version bigint PRIMARY KEY,
			name text NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`)
	if err != nil {
		return fmt.Errorf("ensure migration table: %w", err)
	}
	return nil
}

func appliedVersions(ctx context.Context, connection *pgxpool.Conn) (map[int64]bool, error) {
	rows, err := connection.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, fmt.Errorf("list applied migrations: %w", err)
	}
	defer rows.Close()
	versions := make(map[int64]bool)
	for rows.Next() {
		var version int64
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("scan applied migration: %w", err)
		}
		versions[version] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read applied migrations: %w", err)
	}
	return versions, nil
}

func applyMigration(ctx context.Context, connection *pgxpool.Conn, migration Migration, up bool) error {
	tx, err := connection.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration %06d: %w", migration.Version, err)
	}
	defer tx.Rollback(ctx)
	statement := migration.Up
	direction := "up"
	if !up {
		statement = migration.Down
		direction = "down"
	}
	if _, err := tx.Exec(ctx, statement, pgx.QueryExecModeSimpleProtocol); err != nil {
		return fmt.Errorf("apply %s migration %06d: %w", direction, migration.Version, err)
	}
	if up {
		_, err = tx.Exec(ctx, `INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, migration.Version, migration.Name)
	} else {
		_, err = tx.Exec(ctx, `DELETE FROM schema_migrations WHERE version = $1`, migration.Version)
	}
	if err != nil {
		return fmt.Errorf("record %s migration %06d: %w", direction, migration.Version, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit %s migration %06d: %w", direction, migration.Version, err)
	}
	return nil
}

func withMigrationLock(ctx context.Context, pool *pgxpool.Pool, operation func(*pgxpool.Conn) error) error {
	connection, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer connection.Release()
	if _, err := connection.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationLockID); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		_, _ = connection.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, migrationLockID)
	}()
	return operation(connection)
}
