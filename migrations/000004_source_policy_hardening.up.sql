ALTER TABLE sources
    ADD COLUMN minimum_records integer NOT NULL DEFAULT 1,
    ADD COLUMN maximum_quarantine_ratio_bps integer NOT NULL DEFAULT 200,
    ADD COLUMN registration_hosts text[] NOT NULL DEFAULT '{}',
    ADD COLUMN image_hosts text[] NOT NULL DEFAULT '{}',
    ADD CONSTRAINT sources_minimum_records_check
        CHECK (minimum_records >= 0 AND minimum_records <= record_limit),
    ADD CONSTRAINT sources_quarantine_ratio_check
        CHECK (maximum_quarantine_ratio_bps BETWEEN 0 AND 10000),
    ADD CONSTRAINT sources_registration_hosts_check
        CHECK (array_position(registration_hosts, NULL) IS NULL),
    ADD CONSTRAINT sources_image_hosts_check
        CHECK (array_position(image_hosts, NULL) IS NULL);

UPDATE sources
SET minimum_records = 1,
    maximum_quarantine_ratio_bps = 200,
    registration_hosts = ARRAY['bangaloreinternationalcentre.org'],
    image_hosts = ARRAY['bangaloreinternationalcentre.org']
WHERE id = '019c5d13-c392-79d2-9012-3ed4242f771f';

UPDATE sources
SET minimum_records = 1,
    maximum_quarantine_ratio_bps = 200,
    registration_hosts = ARRAY['in.bookmyshow.com'],
    image_hosts = ARRAY['www.jagrititheatre.com']
WHERE id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f';

ALTER TABLE collection_runs
    DROP CONSTRAINT collection_runs_status_check,
    ADD CONSTRAINT collection_runs_status_check
        CHECK (status IN ('queued', 'triggering', 'collecting', 'validating', 'published', 'rejected', 'failed'));

ALTER TABLE event_occurrences
    ADD CONSTRAINT event_occurrences_start_local_date_check
        CHECK (starts_at IS NULL OR (starts_at AT TIME ZONE timezone)::date = start_date),
    ADD CONSTRAINT event_occurrences_end_local_date_check
        CHECK (ends_at IS NULL OR (end_date IS NOT NULL AND (ends_at AT TIME ZONE timezone)::date = end_date));

ALTER TABLE event_versions
    ADD CONSTRAINT event_versions_start_local_date_check
        CHECK (starts_at IS NULL OR (starts_at AT TIME ZONE timezone)::date = start_date),
    ADD CONSTRAINT event_versions_end_local_date_check
        CHECK (ends_at IS NULL OR (end_date IS NOT NULL AND (ends_at AT TIME ZONE timezone)::date = end_date));

ALTER TABLE source_aliases
    ADD COLUMN idempotency_key text,
    ADD COLUMN idempotency_is_legacy boolean NOT NULL DEFAULT false;

UPDATE source_aliases
SET idempotency_key = 'legacy-alias-' || old_identity,
    idempotency_is_legacy = true;

ALTER TABLE source_aliases
    ALTER COLUMN idempotency_key SET NOT NULL,
    ADD CONSTRAINT source_aliases_idempotency_key_check
        CHECK (length(idempotency_key) BETWEEN 16 AND 200),
    ADD CONSTRAINT source_aliases_legacy_idempotency_check
        CHECK (NOT idempotency_is_legacy OR idempotency_key = 'legacy-alias-' || old_identity),
    ADD CONSTRAINT source_aliases_reason_length_check
        CHECK (char_length(reason) <= 1000),
    ADD CONSTRAINT source_aliases_source_idempotency_key_unique
        UNIQUE (source_id, idempotency_key);
