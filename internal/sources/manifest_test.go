package sources

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTrackedSourceManifestsSatisfyStrictV1Contract(t *testing.T) {
	manifests, err := LoadManifestRepository(filepath.Join("..", "..", "sources"))
	if err != nil {
		t.Fatal(err)
	}
	if len(manifests) < 4 {
		t.Fatalf("tracked manifests = %d, want at least 4", len(manifests))
	}
	active := 0
	for _, manifest := range manifests {
		if manifest.PublicationState != "active" {
			continue
		}
		active++
		if _, err := manifest.Projection(); err != nil {
			t.Fatalf("active manifest %s has no deterministic projection: %v", manifest.Path, err)
		}
	}
	if active != 2 {
		t.Fatalf("active manifests = %d, want 2", active)
	}
}

func TestManifestLoaderRejectsUnknownFieldsAndAliases(t *testing.T) {
	valid, err := os.ReadFile(filepath.Join("..", "..", "sources", "bengaluru", "bic", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{
		"unknown field": string(valid) + "\nunreviewed_switch: true\n",
		"alias":         strings.Replace(string(valid), "source: bic", "source: &slug bic", 1) + "\nunknown: *slug\n",
		"second doc":    string(valid) + "\n---\n{}\n",
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "source.yaml")
			if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := LoadManifest(path); err == nil {
				t.Fatal("invalid manifest was accepted")
			}
		})
	}
}

func TestActiveManifestHealthRatiosProjectExactlyToBasisPoints(t *testing.T) {
	tests := map[string]struct {
		duplicate int
		low       int
		high      int
	}{
		"bic":     {duplicate: 100, low: 4000, high: 25000},
		"jagriti": {duplicate: 0, low: 5000, high: 20000},
	}
	for source, want := range tests {
		t.Run(source, func(t *testing.T) {
			manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "bengaluru", source, "source.yaml"))
			if err != nil {
				t.Fatal(err)
			}
			projection, err := manifest.Projection()
			if err != nil {
				t.Fatal(err)
			}
			if projection.MaximumDuplicateRatioBPS != want.duplicate || projection.LowCountRatioBPS != want.low || projection.HighCountRatioBPS != want.high {
				t.Fatalf("duplicate/low/high BPS = %d/%d/%d, want %d/%d/%d",
					projection.MaximumDuplicateRatioBPS, projection.LowCountRatioBPS, projection.HighCountRatioBPS,
					want.duplicate, want.low, want.high)
			}
		})
	}
}
