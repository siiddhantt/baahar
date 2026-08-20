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
    '7bb2b2bf-66bb-5cfe-8269-ea811552d9c7',
    '7eb386b1-1bf5-5cd4-828f-a288683eef55',
    'prithvi-theatre',
    'Prithvi Theatre',
    'prithvitheatre.org',
    'https://prithvitheatre.org/booktickets',
    'source-manifest/v1',
    'c_mt1qtstu9kmw95k4q',
    'event-occurrence/v1',
    '{"url":"https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV"}'::jsonb,
    '^[1-9][0-9]*$',
    true,
    43200,
    21600,
    1,
    100,
    4,
    2,
    'active',
    now(),
    3,
    0,
    ARRAY['in.bookmyshow.com'],
    ARRAY['in.bmscdn.com'],
    0,
    5000,
    20000
);

UPDATE cities
SET enabled = true
WHERE id = '7eb386b1-1bf5-5cd4-828f-a288683eef55'
  AND slug = 'mumbai';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cities
        WHERE id = '7eb386b1-1bf5-5cd4-828f-a288683eef55'
          AND slug = 'mumbai'
          AND enabled
    ) THEN
        RAISE EXCEPTION 'Mumbai city identity is missing or incompatible';
    END IF;
END $$;
