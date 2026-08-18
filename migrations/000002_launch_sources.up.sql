INSERT INTO cities (id, slug, display_name, timezone, accent, enabled)
VALUES
    ('019c5d13-c392-79d2-9012-3ed4242f771d', 'bengaluru', 'Bengaluru', 'Asia/Kolkata', 'rain', true),
    ('019c5d13-c392-79d2-9012-3ed4242f771e', 'varanasi', 'Varanasi', 'Asia/Kolkata', 'river', false)
ON CONFLICT (slug) DO NOTHING;

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
    next_due_at
)
SELECT
    '019c5d13-c392-79d2-9012-3ed4242f771f',
    city.id,
    'bic',
    'Bangalore International Centre',
    'bangaloreinternationalcentre.org',
    'https://bangaloreinternationalcentre.org/',
    'source-manifest/v1',
    'c_msyr5ts21rq3nfjxrz',
    'event-occurrence/v1',
    '{"url":"https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events"}'::jsonb,
    '^[0-9]+$',
    true,
    43200,
    14400,
    2,
    100,
    6,
    2,
    'active',
    now()
FROM cities city
WHERE city.slug = 'bengaluru'
ON CONFLICT (slug) DO NOTHING;
