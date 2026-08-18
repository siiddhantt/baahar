package s3

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const maximumSnapshotBytes = 64 << 20

type Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	Region    string
	PathStyle bool
}

type Snapshot struct {
	Key    string
	SHA256 string
	Bytes  int64
}

type Store struct {
	client *minio.Client
	bucket string
}

func Open(config Config) (*Store, error) {
	if strings.TrimSpace(config.Endpoint) == "" || strings.TrimSpace(config.Bucket) == "" {
		return nil, errors.New("object-store endpoint and bucket are required")
	}
	endpoint, err := url.Parse(config.Endpoint)
	if err != nil {
		return nil, fmt.Errorf("parse object-store endpoint: %w", err)
	}
	if (endpoint.Scheme != "http" && endpoint.Scheme != "https") || endpoint.Host == "" || endpoint.Path != "" || endpoint.RawQuery != "" || endpoint.User != nil {
		return nil, errors.New("object-store endpoint must be an HTTP(S) origin without path, query, or credentials")
	}
	bucketLookup := minio.BucketLookupAuto
	if config.PathStyle {
		bucketLookup = minio.BucketLookupPath
	}
	client, err := minio.New(endpoint.Host, &minio.Options{
		Creds:        credentials.NewStaticV4(config.AccessKey, config.SecretKey, ""),
		Secure:       endpoint.Scheme == "https",
		Region:       config.Region,
		BucketLookup: bucketLookup,
	})
	if err != nil {
		return nil, fmt.Errorf("create object-store client: %w", err)
	}
	return &Store{client: client, bucket: config.Bucket}, nil
}

func (store *Store) EnsureBucket(ctx context.Context) error {
	exists, err := store.client.BucketExists(ctx, store.bucket)
	if err != nil {
		return fmt.Errorf("check raw bucket: %w", err)
	}
	if exists {
		return nil
	}
	if err := store.client.MakeBucket(ctx, store.bucket, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("create raw bucket: %w", err)
	}
	return nil
}

func (store *Store) Put(ctx context.Context, key string, content []byte) (Snapshot, error) {
	if err := validateKey(key); err != nil {
		return Snapshot{}, err
	}
	if len(content) > maximumSnapshotBytes {
		return Snapshot{}, fmt.Errorf("snapshot exceeds %d-byte limit", maximumSnapshotBytes)
	}
	digest := sha256.Sum256(content)
	sha := hex.EncodeToString(digest[:])
	if existing, found, err := store.existingSnapshot(ctx, key, sha); err != nil {
		return Snapshot{}, err
	} else if found {
		return existing, nil
	}
	options := minio.PutObjectOptions{
		ContentType:    "application/octet-stream",
		SendContentMd5: true,
		UserMetadata: map[string]string{
			"sha256": sha,
		},
	}
	options.SetMatchETagExcept("*")
	info, err := store.client.PutObject(ctx, store.bucket, key, bytes.NewReader(content), int64(len(content)), options)
	if err != nil {
		if existing, found, statErr := store.existingSnapshot(ctx, key, sha); statErr == nil && found {
			return existing, nil
		}
		return Snapshot{}, fmt.Errorf("store raw snapshot: %w", err)
	}
	if info.Size != int64(len(content)) {
		return Snapshot{}, fmt.Errorf("stored byte count %d does not match input %d", info.Size, len(content))
	}
	return Snapshot{Key: key, SHA256: sha, Bytes: info.Size}, nil
}

func (store *Store) existingSnapshot(ctx context.Context, key, expectedSHA string) (Snapshot, bool, error) {
	info, err := store.client.StatObject(ctx, store.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		response := minio.ToErrorResponse(err)
		if response.Code == "NoSuchKey" || response.Code == "NoSuchObject" || response.Code == "NotFound" {
			return Snapshot{}, false, nil
		}
		return Snapshot{}, false, fmt.Errorf("check raw snapshot: %w", err)
	}
	actualSHA := info.Metadata.Get("X-Amz-Meta-Sha256")
	if actualSHA != expectedSHA {
		return Snapshot{}, false, errors.New("immutable snapshot key already contains different bytes")
	}
	return Snapshot{Key: key, SHA256: actualSHA, Bytes: info.Size}, true, nil
}

func (store *Store) Get(ctx context.Context, key string) ([]byte, Snapshot, error) {
	if err := validateKey(key); err != nil {
		return nil, Snapshot{}, err
	}
	object, err := store.client.GetObject(ctx, store.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, Snapshot{}, fmt.Errorf("open raw snapshot: %w", err)
	}
	defer object.Close()
	info, err := object.Stat()
	if err != nil {
		return nil, Snapshot{}, fmt.Errorf("stat raw snapshot: %w", err)
	}

	content, err := io.ReadAll(io.LimitReader(object, maximumSnapshotBytes+1))
	if err != nil {
		return nil, Snapshot{}, fmt.Errorf("read raw snapshot: %w", err)
	}
	if len(content) > maximumSnapshotBytes {
		return nil, Snapshot{}, fmt.Errorf("stored snapshot exceeds %d-byte limit", maximumSnapshotBytes)
	}
	digest := sha256.Sum256(content)
	sha := hex.EncodeToString(digest[:])
	if info.Size != int64(len(content)) {
		return nil, Snapshot{}, fmt.Errorf("stored byte count %d does not match downloaded %d", info.Size, len(content))
	}
	if expected := info.Metadata.Get("X-Amz-Meta-Sha256"); expected == "" || expected != sha {
		return nil, Snapshot{}, errors.New("raw snapshot SHA-256 metadata does not match downloaded bytes")
	}
	return content, Snapshot{
		Key:    key,
		SHA256: sha,
		Bytes:  int64(len(content)),
	}, nil
}

func validateKey(key string) error {
	if strings.TrimSpace(key) == "" || strings.HasPrefix(key, "/") || strings.Contains(key, "..") {
		return errors.New("snapshot key must be a non-empty relative object key")
	}
	return nil
}
