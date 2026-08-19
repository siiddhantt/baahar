DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM collection_runs WHERE status = 'triggering') THEN
        RAISE EXCEPTION 'cannot remove triggering state while collection runs require reconciliation';
    END IF;
    IF EXISTS (SELECT 1 FROM source_aliases WHERE NOT idempotency_is_legacy) THEN
        RAISE EXCEPTION 'cannot remove operator-owned alias idempotency keys';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM sources
        WHERE NOT (
            (id = '019c5d13-c392-79d2-9012-3ed4242f771f'
                AND minimum_records = 1
                AND maximum_quarantine_ratio_bps = 200
                AND registration_hosts = ARRAY['bangaloreinternationalcentre.org']::text[]
                AND image_hosts = ARRAY['bangaloreinternationalcentre.org']::text[])
            OR (id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f'
                AND minimum_records = 1
                AND maximum_quarantine_ratio_bps = 200
                AND registration_hosts = ARRAY['in.bookmyshow.com']::text[]
                AND image_hosts = ARRAY['www.jagrititheatre.com']::text[])
            OR (id NOT IN (
                    '019c5d13-c392-79d2-9012-3ed4242f771f',
                    'de7c8acb-0185-5994-b1b4-290029c3ed5f'
                )
                AND minimum_records = 1
                AND maximum_quarantine_ratio_bps = 200
                AND registration_hosts = '{}'::text[]
                AND image_hosts = '{}'::text[])
        )
    ) THEN
        RAISE EXCEPTION 'cannot remove source policy values that are not recoverable on reapply';
    END IF;
END $$;

ALTER TABLE source_aliases
    DROP CONSTRAINT source_aliases_source_idempotency_key_unique,
    DROP CONSTRAINT source_aliases_reason_length_check,
    DROP CONSTRAINT source_aliases_legacy_idempotency_check,
    DROP CONSTRAINT source_aliases_idempotency_key_check,
    DROP COLUMN idempotency_is_legacy,
    DROP COLUMN idempotency_key;

ALTER TABLE collection_runs
    DROP CONSTRAINT collection_runs_status_check,
    ADD CONSTRAINT collection_runs_status_check
        CHECK (status IN ('queued', 'collecting', 'validating', 'published', 'rejected', 'failed'));

ALTER TABLE event_versions
    DROP CONSTRAINT event_versions_end_local_date_check,
    DROP CONSTRAINT event_versions_start_local_date_check;

ALTER TABLE event_occurrences
    DROP CONSTRAINT event_occurrences_end_local_date_check,
    DROP CONSTRAINT event_occurrences_start_local_date_check;

ALTER TABLE sources
    DROP CONSTRAINT sources_image_hosts_check,
    DROP CONSTRAINT sources_registration_hosts_check,
    DROP CONSTRAINT sources_quarantine_ratio_check,
    DROP CONSTRAINT sources_minimum_records_check,
    DROP COLUMN image_hosts,
    DROP COLUMN registration_hosts,
    DROP COLUMN maximum_quarantine_ratio_bps,
    DROP COLUMN minimum_records;
