package postgres

import (
	"testing"
	"testing/fstest"
)

func TestReadMigrationsPairsDirectionsAndKeepsName(t *testing.T) {
	files := fstest.MapFS{
		"000002_add_events.down.sql": {Data: []byte("DROP TABLE events;")},
		"000001_initial.down.sql":    {Data: []byte("DROP TABLE cities;")},
		"000002_add_events.up.sql":   {Data: []byte("CREATE TABLE events (id int);")},
		"000001_initial.up.sql":      {Data: []byte("CREATE TABLE cities (id int);")},
	}
	migrations, err := ReadMigrations(files)
	if err != nil {
		t.Fatal(err)
	}
	if len(migrations) != 2 {
		t.Fatalf("migration count = %d, want 2", len(migrations))
	}
	if migrations[0].Version != 1 || migrations[0].Name != "initial" {
		t.Fatalf("first migration = %+v, want version 1 named initial", migrations[0])
	}
	if migrations[1].Version != 2 || migrations[1].Name != "add_events" {
		t.Fatalf("second migration = %+v, want version 2 named add_events", migrations[1])
	}
}
