package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"time"

	"github.com/siddhantk232/baahar/internal/platform/postgres"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: migrate up|down|version")
	}
	databaseURL := os.Getenv("BAAHAR_DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("BAAHAR_DATABASE_URL is required")
	}
	migrationDirectory := os.Getenv("BAAHAR_MIGRATIONS_DIR")
	if migrationDirectory == "" {
		migrationDirectory = "migrations"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	pool, err := postgres.Open(ctx, postgres.PoolConfig{URL: databaseURL, MaximumOpenConns: 2, StatementTimeout: 90 * time.Second})
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	files := os.DirFS(migrationDirectory)
	migrations, err := postgres.ReadMigrations(fs.FS(files))
	if err != nil {
		log.Fatal(err)
	}
	switch os.Args[1] {
	case "up":
		err = postgres.MigrateUp(ctx, pool, migrations)
	case "down":
		err = postgres.MigrateDown(ctx, pool, migrations)
	case "version":
		var version int64
		version, err = postgres.MigrationVersion(ctx, pool)
		if err == nil {
			fmt.Println(version)
		}
	default:
		log.Fatal("usage: migrate up|down|version")
	}
	if err != nil {
		log.Fatal(err)
	}
}
