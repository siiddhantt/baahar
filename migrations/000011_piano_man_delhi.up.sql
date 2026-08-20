INSERT INTO sources (
    id,
    city_id,
    slug,
    display_name,
    canonical_host,
    official_url,
    manifest_version,
    collector_id,
    schema_version,
    collection_input,
    source_event_id_pattern,
    enabled,
    freshness_ttl_seconds,
    cadence_seconds,
    page_limit,
    record_limit,
    daily_run_limit,
    absence_threshold,
    publication_state,
    next_due_at,
    minimum_records,
    maximum_quarantine_ratio_bps,
    registration_hosts,
    image_hosts,
    maximum_duplicate_ratio_bps,
    low_count_ratio_bps,
    high_count_ratio_bps
)
VALUES (
    '7129ebd4-8cc9-524f-85bd-f9cde8b6d7b3',
    '19f16354-f054-53e8-bfb6-2b1e1acdcd00',
    'the-piano-man',
    'The Piano Man',
    'www.thepianoman.in',
    'https://www.thepianoman.in/event/list',
    'source-manifest/v1',
    'c_mt1rkddl1dmh5iiok6',
    'event-occurrence/v1',
    '{"url":"https://www.thepianoman.in/event/list"}'::jsonb,
    '^[0-9]+$',
    true,
    43200,
    21600,
    13,
    150,
    4,
    2,
    'active',
    now(),
    1,
    0,
    ARRAY['www.thepianoman.in'],
    ARRAY['www.thepianoman.in'],
    0,
    4000,
    25000
);

UPDATE cities
SET enabled = true
WHERE id = '19f16354-f054-53e8-bfb6-2b1e1acdcd00'
  AND slug = 'delhi';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cities
        WHERE id = '19f16354-f054-53e8-bfb6-2b1e1acdcd00'
          AND slug = 'delhi'
          AND enabled
    ) THEN
        RAISE EXCEPTION 'Delhi city identity is missing or incompatible';
    END IF;
END $$;
