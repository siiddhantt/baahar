package s3

import (
	"bytes"
	"context"
	"os"
	"testing"
	"time"
)

func TestExactByteRoundTrip(t *testing.T) {
	endpoint := os.Getenv("BAAHAR_TEST_S3_ENDPOINT")
	if endpoint == "" {
		t.Skip("BAAHAR_TEST_S3_ENDPOINT is not set; real MinIO integration test skipped")
	}
	store, err := Open(Config{
		Endpoint:  endpoint,
		AccessKey: os.Getenv("BAAHAR_TEST_S3_ACCESS_KEY"),
		SecretKey: os.Getenv("BAAHAR_TEST_S3_SECRET_KEY"),
		Bucket:    "baahar-test-raw",
		Region:    "us-east-1",
		PathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := store.EnsureBucket(ctx); err != nil {
		t.Fatal(err)
	}

	want := []byte("{\"unicode\":\"ಬೆಂಗಳೂರು • वाराणसी\",\"price\":null}\r\n")
	put, err := store.Put(ctx, "integration/exact-bytes.ndjson", want)
	if err != nil {
		t.Fatal(err)
	}
	got, fetched, err := store.Get(ctx, put.Key)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("stored bytes changed: got %q, want %q", got, want)
	}
	if fetched.SHA256 != put.SHA256 || fetched.Bytes != int64(len(want)) {
		t.Fatalf("metadata mismatch: put=%+v fetched=%+v", put, fetched)
	}
}
