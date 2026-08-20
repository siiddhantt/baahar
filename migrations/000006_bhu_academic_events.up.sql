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
    'bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd',
    '019c5d13-c392-79d2-9012-3ed4242f771e',
    'bhu-academic-events',
    'BHU Academic Events',
    'www.bhu.ac.in',
    'https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming',
    'source-manifest/v1',
    'c_mszvpbm220j1pld0pe',
    'event-occurrence/v1',
    '{"url":"https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming"}'::jsonb,
    '^[1-9][0-9]*$',
    true,
    43200,
    21600,
    1,
    20,
    4,
    2,
    'active',
    now(),
    3,
    0,
    ARRAY['forms.gle'],
    ARRAY[]::text[],
    0,
    5000,
    20000
);

DO $$
BEGIN
    UPDATE cities
    SET enabled = true
    WHERE id = '019c5d13-c392-79d2-9012-3ed4242f771e'
      AND slug = 'varanasi';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Varanasi city identity is missing or incompatible';
    END IF;
END $$;
