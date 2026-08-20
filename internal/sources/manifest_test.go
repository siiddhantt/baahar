package sources

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
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
	if active != 5 {
		t.Fatalf("active manifests = %d, want 5", active)
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
		city      string
		duplicate int
		low       int
		high      int
	}{
		"bic":                 {city: "bengaluru", duplicate: 100, low: 4000, high: 25000},
		"jagriti":             {city: "bengaluru", duplicate: 0, low: 5000, high: 20000},
		"atta-galatta":        {city: "bengaluru", duplicate: 0, low: 5000, high: 20000},
		"biec":                {city: "bengaluru", duplicate: 0, low: 5000, high: 20000},
		"bhu-academic-events": {city: "varanasi", duplicate: 0, low: 5000, high: 20000},
	}
	for source, want := range tests {
		t.Run(source, func(t *testing.T) {
			manifest, err := LoadManifest(filepath.Join("..", "..", "sources", want.city, source, "source.yaml"))
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

func TestBIECManifestKeepsTheReviewedSingleRequestBoundary(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "bengaluru", "biec", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SourceID != "520e6232-ab55-5c71-8918-bb68a659ae61" ||
		manifest.CityID != "019c5d13-c392-79d2-9012-3ed4242f771d" ||
		manifest.CollectorID != "c_mt199f5m1k5i18ud1i" || manifest.WorkerType != "code" ||
		len(manifest.CanonicalHosts) != 1 || manifest.CanonicalHosts[0] != "www.biec.in" ||
		len(manifest.RegistrationHosts) != 0 ||
		len(manifest.ImageHosts) != 1 || manifest.ImageHosts[0] != "www.biec.in" ||
		manifest.Limits.PagesPerRun != 1 ||
		manifest.Limits.MaximumPhysicalRequestsInLivePreflight != 1 || manifest.Access == nil ||
		manifest.Access.PagesPerRun != 1 || manifest.CollectionInput == nil ||
		manifest.CollectionInput.URL != "https://www.biec.in/events" {
		t.Fatalf("BIEC reviewed identity/request boundary = %+v", manifest)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte(manifest.CollectionInput.URL)).String(); got != manifest.SourceID {
		t.Fatalf("BIEC source_id = %s, want URL UUIDv5 %s", manifest.SourceID, got)
	}
	projection, err := manifest.Projection()
	if err != nil {
		t.Fatal(err)
	}
	if projection.PageLimit != 1 || projection.RecordLimit != 50 || projection.DailyRunLimit != 4 ||
		projection.MinimumRecords != 3 || projection.MaximumQuarantineRatioBPS != 0 ||
		projection.MaximumDuplicateRatioBPS != 0 || projection.SourceEventIDPattern != nil {
		t.Fatalf("BIEC runtime projection = %+v", projection)
	}
}

func TestAttaGalattaManifestKeepsTheReviewedSingleRequestBoundary(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "bengaluru", "atta-galatta", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SourceID != "854afb9d-c219-5f8f-b8a5-f0b8b24ae799" ||
		manifest.CityID != "019c5d13-c392-79d2-9012-3ed4242f771d" ||
		manifest.CollectorID != "c_mt006uf51wdkssg1lh" || manifest.WorkerType != "code" ||
		len(manifest.CanonicalHosts) != 1 || manifest.CanonicalHosts[0] != "attagalatta.com" ||
		len(manifest.RegistrationHosts) != 0 ||
		len(manifest.ImageHosts) != 1 || manifest.ImageHosts[0] != "attagalatta.com" ||
		manifest.Limits.PagesPerRun != 1 ||
		manifest.Limits.MaximumPhysicalRequestsInLivePreflight != 1 || manifest.Access == nil ||
		manifest.Access.PagesPerRun != 1 {
		t.Fatalf("Atta Galatta reviewed identity/request boundary = %+v", manifest)
	}
	projection, err := manifest.Projection()
	if err != nil {
		t.Fatal(err)
	}
	if projection.PageLimit != 1 || projection.RecordLimit != 100 || projection.DailyRunLimit != 6 ||
		projection.MinimumRecords != 3 || projection.MaximumQuarantineRatioBPS != 0 ||
		projection.MaximumDuplicateRatioBPS != 0 || projection.SourceEventIDPattern == nil ||
		*projection.SourceEventIDPattern != `^EVT[0-9]+$` {
		t.Fatalf("Atta Galatta runtime projection = %+v", projection)
	}
}

func TestBHUManifestKeepsTheReviewedSingleRequestBoundary(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "varanasi", "bhu-academic-events", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SourceID != "bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd" ||
		manifest.CityID != "019c5d13-c392-79d2-9012-3ed4242f771e" ||
		manifest.CollectorID != "c_mszvpbm220j1pld0pe" || manifest.WorkerType != "code" ||
		len(manifest.CanonicalHosts) != 1 || manifest.CanonicalHosts[0] != "www.bhu.ac.in" ||
		len(manifest.RegistrationHosts) != 1 || manifest.RegistrationHosts[0] != "forms.gle" ||
		manifest.Limits.PagesPerRun != 1 ||
		manifest.Limits.MaximumPhysicalRequestsInLivePreflight != 1 || manifest.Access == nil ||
		manifest.Access.PagesPerRun != 1 {
		t.Fatalf("BHU reviewed identity/request boundary = %+v", manifest)
	}
	projection, err := manifest.Projection()
	if err != nil {
		t.Fatal(err)
	}
	if projection.PageLimit != 1 || projection.RecordLimit != 20 || projection.MinimumRecords != 3 ||
		projection.MaximumQuarantineRatioBPS != 0 || projection.MaximumDuplicateRatioBPS != 0 {
		t.Fatalf("BHU runtime projection = %+v", projection)
	}
}

func TestIHCManifestKeepsTheReviewedDevelopmentOnlyBoundary(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "delhi", "india-habitat-centre", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SourceID != "61f49230-ea6a-5a96-aeb8-c481d806978b" ||
		manifest.CityID != "19f16354-f054-53e8-bfb6-2b1e1acdcd00" ||
		manifest.CollectorID != "c_mt1gyvqb8ftcpex5b" || manifest.WorkerType != "code" ||
		manifest.PublicationState != "preview" || manifest.CollectionState != "local_verified" ||
		len(manifest.CanonicalHosts) != 1 || manifest.CanonicalHosts[0] != "indiahabitat.org" ||
		len(manifest.RegistrationHosts) != 0 ||
		len(manifest.ImageHosts) != 1 || manifest.ImageHosts[0] != "indiahabitat.org" ||
		manifest.Limits.PagesPerRun != 1 || manifest.Limits.RecordsPerRun != 100 ||
		manifest.Limits.BrowserNavigationsPerRun != 0 || manifest.Limits.BrowserActionsPerRun != 0 ||
		manifest.Limits.BrowserFanoutPerRun != 0 ||
		manifest.Limits.MaximumPhysicalRequestsInLivePreflight != 1 || manifest.Access == nil ||
		manifest.Access.PagesPerRun != 1 || manifest.CollectionInput == nil ||
		manifest.CollectionInput.URL != "https://indiahabitat.org/Events" {
		t.Fatalf("IHC reviewed development/request boundary = %+v", manifest)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte(manifest.CollectionInput.URL)).String(); got != manifest.SourceID {
		t.Fatalf("IHC source_id = %s, want URL UUIDv5 %s", manifest.SourceID, got)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte("https://baahar.app/cities/delhi")).String(); got != manifest.CityID {
		t.Fatalf("IHC reserved city_id = %s, want URL UUIDv5 %s", manifest.CityID, got)
	}
	if _, err := manifest.Projection(); err == nil {
		t.Fatal("preview/local-verified IHC manifest unexpectedly has a runtime projection")
	}
}

func TestPianoManManifestKeepsTheReviewedDevelopmentOnlyBoundary(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "delhi", "the-piano-man", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SourceID != "7129ebd4-8cc9-524f-85bd-f9cde8b6d7b3" ||
		manifest.CityID != "19f16354-f054-53e8-bfb6-2b1e1acdcd00" ||
		manifest.CollectorID != "c_mt1rkddl1dmh5iiok6" || manifest.WorkerType != "code" ||
		manifest.PublicationState != "preview" || manifest.CollectionState != "local_verified" ||
		len(manifest.CanonicalHosts) != 1 || manifest.CanonicalHosts[0] != "www.thepianoman.in" ||
		len(manifest.RegistrationHosts) != 1 || manifest.RegistrationHosts[0] != "www.thepianoman.in" ||
		len(manifest.ImageHosts) != 1 || manifest.ImageHosts[0] != "www.thepianoman.in" ||
		manifest.Limits.PagesPerRun != 13 || manifest.Limits.RecordsPerRun != 150 ||
		manifest.Limits.BrowserNavigationsPerRun != 0 || manifest.Limits.BrowserActionsPerRun != 0 ||
		manifest.Limits.BrowserFanoutPerRun != 0 ||
		manifest.Limits.MaximumPhysicalRequestsInLivePreflight != 13 || manifest.Access == nil ||
		manifest.Access.PagesPerRun != 13 || manifest.CollectionInput == nil ||
		manifest.CollectionInput.URL != "https://www.thepianoman.in/event/list" {
		t.Fatalf("Piano Man reviewed local/request boundary = %+v", manifest)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte(manifest.CollectionInput.URL)).String(); got != manifest.SourceID {
		t.Fatalf("Piano Man source_id = %s, want URL UUIDv5 %s", manifest.SourceID, got)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte("https://baahar.app/cities/delhi")).String(); got != manifest.CityID {
		t.Fatalf("Piano Man reserved city_id = %s, want URL UUIDv5 %s", manifest.CityID, got)
	}
	if _, err := manifest.Projection(); err == nil {
		t.Fatal("preview/local-verified Piano Man manifest unexpectedly has a runtime projection")
	}
}

func TestPrithviManifestKeepsTheReviewedMumbaiPreviewBoundary(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "sources", "mumbai", "prithvi-theatre", "source.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SourceID != "7bb2b2bf-66bb-5cfe-8269-ea811552d9c7" ||
		manifest.CityID != "7eb386b1-1bf5-5cd4-828f-a288683eef55" ||
		manifest.CollectorID != "c_mt1qtstu9kmw95k4q" || manifest.WorkerType != "code" ||
		manifest.PublicationState != "preview" || manifest.CollectionState != "verified" ||
		len(manifest.CanonicalHosts) != 1 || manifest.CanonicalHosts[0] != "prithvitheatre.org" ||
		len(manifest.RegistrationHosts) != 1 || manifest.RegistrationHosts[0] != "in.bookmyshow.com" ||
		len(manifest.ImageHosts) != 1 || manifest.ImageHosts[0] != "in.bmscdn.com" ||
		manifest.Limits.PagesPerRun != 1 || manifest.Limits.RecordsPerRun != 100 ||
		manifest.Limits.MaximumPhysicalRequestsInLivePreflight != 1 || manifest.Access == nil ||
		manifest.Access.PagesPerRun != 1 || manifest.CollectionInput == nil ||
		manifest.CollectionInput.URL != "https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV" {
		t.Fatalf("Prithvi reviewed Mumbai preview boundary = %+v", manifest)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte(manifest.CollectionInput.URL)).String(); got != manifest.SourceID {
		t.Fatalf("Prithvi source_id = %s, want URL UUIDv5 %s", manifest.SourceID, got)
	}
	if got := uuid.NewSHA1(uuid.NameSpaceURL, []byte("https://baahar.app/cities/mumbai")).String(); got != manifest.CityID {
		t.Fatalf("Prithvi reserved city_id = %s, want URL UUIDv5 %s", manifest.CityID, got)
	}
	if _, err := manifest.Projection(); err == nil {
		t.Fatal("preview/verified Prithvi manifest unexpectedly has a runtime projection")
	}
}
