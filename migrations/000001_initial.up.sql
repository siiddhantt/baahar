CREATE TABLE cities (
    id uuid PRIMARY KEY,
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    timezone text NOT NULL CHECK (btrim(timezone) <> ''),
    accent text NOT NULL CHECK (accent IN ('rain', 'river')),
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venues (
    id uuid PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES cities(id),
    name text NOT NULL CHECK (btrim(name) <> ''),
    normalized_key text,
    address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX venues_reviewed_key_idx
    ON venues (city_id, normalized_key)
    WHERE normalized_key IS NOT NULL;

CREATE TABLE sources (
    id uuid PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES cities(id),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    canonical_host text NOT NULL CHECK (canonical_host = lower(canonical_host)),
    official_url text NOT NULL,
    manifest_version text NOT NULL,
    collector_id text NOT NULL UNIQUE CHECK (collector_id ~ '^c_[A-Za-z0-9_-]+$'),
    schema_version text NOT NULL,
    collection_input jsonb NOT NULL CHECK (jsonb_typeof(collection_input) = 'object'),
    source_event_id_pattern text,
    enabled boolean NOT NULL DEFAULT false,
    freshness_ttl_seconds integer NOT NULL CHECK (freshness_ttl_seconds > 0),
    cadence_seconds integer NOT NULL CHECK (cadence_seconds > 0),
    page_limit integer NOT NULL CHECK (page_limit > 0),
    record_limit integer NOT NULL CHECK (record_limit > 0),
    daily_run_limit integer NOT NULL CHECK (daily_run_limit > 0),
    absence_threshold smallint NOT NULL CHECK (absence_threshold >= 2),
    publication_state text NOT NULL DEFAULT 'active'
        CHECK (publication_state IN ('active', 'frozen', 'disabled')),
    last_healthy_at timestamptz,
    next_due_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sources_due_idx
    ON sources (next_due_at, id)
    WHERE enabled AND publication_state <> 'disabled';

CREATE TABLE collection_runs (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES sources(id),
    prior_run_id uuid REFERENCES collection_runs(id),
    external_collection_id text,
    trace_id text NOT NULL,
    status text NOT NULL
        CHECK (status IN ('queued', 'collecting', 'validating', 'published', 'rejected', 'failed')),
    triggered_at timestamptz NOT NULL,
    completed_at timestamptz,
    raw_object_key text,
    raw_sha256 char(64) CHECK (raw_sha256 ~ '^[0-9a-f]{64}$'),
    raw_bytes bigint CHECK (raw_bytes >= 0),
    received_count integer NOT NULL DEFAULT 0 CHECK (received_count >= 0),
    accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
    quarantined_count integer NOT NULL DEFAULT 0 CHECK (quarantined_count >= 0),
    health_summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(health_summary) = 'object'),
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, external_collection_id),
    CHECK ((completed_at IS NULL) OR (completed_at >= triggered_at)),
    CHECK ((raw_object_key IS NULL) = (raw_sha256 IS NULL)),
    CHECK (accepted_count + quarantined_count <= received_count)
);

CREATE INDEX collection_runs_source_time_idx
    ON collection_runs (source_id, triggered_at DESC, id DESC);

CREATE TABLE quarantined_records (
    id uuid PRIMARY KEY,
    collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
    record_index integer NOT NULL CHECK (record_index >= 0),
    error_code text NOT NULL,
    diagnostic text NOT NULL CHECK (octet_length(diagnostic) <= 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (collection_run_id, record_index, error_code)
);

CREATE TABLE events (
    id uuid PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES cities(id),
    slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    canonical_title text NOT NULL CHECK (btrim(canonical_title) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (city_id, slug)
);

CREATE TABLE event_occurrences (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id),
    source_id uuid NOT NULL REFERENCES sources(id),
    source_identity char(64) NOT NULL CHECK (source_identity ~ '^[0-9a-f]{64}$'),
    start_date date NOT NULL,
    end_date date,
    starts_at timestamptz,
    ends_at timestamptz,
    time_precision text NOT NULL CHECK (time_precision IN ('timed', 'date')),
    timezone text NOT NULL,
    current_version_id uuid,
    visible boolean NOT NULL DEFAULT true,
    missing_observations smallint NOT NULL DEFAULT 0 CHECK (missing_observations >= 0),
    first_observed_at timestamptz NOT NULL,
    last_observed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, source_identity),
    CHECK ((end_date IS NULL) OR (end_date >= start_date)),
    CHECK ((ends_at IS NULL) OR (starts_at IS NOT NULL AND ends_at >= starts_at)),
    CHECK (
        (time_precision = 'timed' AND starts_at IS NOT NULL)
        OR (time_precision = 'date' AND starts_at IS NULL AND ends_at IS NULL)
    ),
    CHECK (last_observed_at >= first_observed_at)
);

CREATE INDEX events_city_idx ON events (city_id, id);

CREATE TABLE event_versions (
    id uuid PRIMARY KEY,
    occurrence_id uuid NOT NULL REFERENCES event_occurrences(id),
    collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
    fingerprint char(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    title text NOT NULL CHECK (btrim(title) <> ''),
    category text NOT NULL CHECK (category IN ('arts', 'talks', 'theatre', 'music', 'books', 'community', 'other')),
    source_url text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    starts_at timestamptz,
    ends_at timestamptz,
    time_precision text NOT NULL CHECK (time_precision IN ('timed', 'date')),
    timezone text NOT NULL,
    venue_name text,
    venue_address text,
    is_free boolean,
    price_min_minor bigint,
    price_max_minor bigint,
    currency char(3),
    registration_url text,
    registration_state text CHECK (registration_state IN ('open', 'sold_out', 'closed', 'not_required')),
    status text NOT NULL CHECK (status IN ('scheduled', 'cancelled', 'postponed')),
    languages text[] NOT NULL DEFAULT '{}',
    age_note text,
    accessibility_note text,
    image_url text,
    observed_at timestamptz NOT NULL,
    canonical_record jsonb NOT NULL CHECK (jsonb_typeof(canonical_record) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (occurrence_id, fingerprint),
    CHECK ((end_date IS NULL) OR (end_date >= start_date)),
    CHECK ((ends_at IS NULL) OR (starts_at IS NOT NULL AND ends_at >= starts_at)),
    CHECK (price_max_minor IS NULL OR price_min_minor IS NOT NULL),
    CHECK ((price_min_minor IS NULL) = (currency IS NULL)),
    CHECK (price_min_minor IS NULL OR (price_min_minor >= 0 AND currency = 'INR' AND is_free = false)),
    CHECK (price_max_minor IS NULL OR price_max_minor >= price_min_minor),
    CHECK (is_free IS DISTINCT FROM true OR (price_min_minor IS NULL AND price_max_minor IS NULL AND currency IS NULL)),
    CHECK (
        (time_precision = 'timed' AND starts_at IS NOT NULL)
        OR (time_precision = 'date' AND starts_at IS NULL AND ends_at IS NULL)
    )
);

ALTER TABLE event_occurrences
    ADD CONSTRAINT event_occurrences_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES event_versions(id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX event_occurrences_feed_idx
    ON event_occurrences (start_date, starts_at, id)
    WHERE current_version_id IS NOT NULL;

CREATE INDEX event_occurrences_event_feed_idx
    ON event_occurrences (event_id, start_date, starts_at, id)
    WHERE current_version_id IS NOT NULL;

CREATE INDEX event_versions_occurrence_time_idx
    ON event_versions (occurrence_id, observed_at DESC, id DESC);

CREATE TABLE event_changes (
    id uuid PRIMARY KEY,
    collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
    occurrence_id uuid NOT NULL REFERENCES event_occurrences(id),
    from_version_id uuid NOT NULL REFERENCES event_versions(id),
    to_version_id uuid NOT NULL REFERENCES event_versions(id),
    kind text NOT NULL CHECK (kind IN ('updated', 'cancelled', 'postponed')),
    changed_fields text[] NOT NULL CHECK (cardinality(changed_fields) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (collection_run_id, occurrence_id),
    CHECK (from_version_id <> to_version_id)
);

CREATE INDEX event_changes_occurrence_time_idx
    ON event_changes (occurrence_id, created_at DESC, id DESC);

CREATE TABLE source_observations (
    collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
    occurrence_id uuid NOT NULL REFERENCES event_occurrences(id),
    state text NOT NULL CHECK (state IN ('present', 'missing')),
    observed_at timestamptz NOT NULL,
    PRIMARY KEY (collection_run_id, occurrence_id)
);

CREATE TABLE source_aliases (
    source_id uuid NOT NULL REFERENCES sources(id),
    old_identity char(64) NOT NULL CHECK (old_identity ~ '^[0-9a-f]{64}$'),
    occurrence_id uuid NOT NULL REFERENCES event_occurrences(id),
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, old_identity)
);

CREATE TABLE jobs (
    id uuid PRIMARY KEY,
    kind text NOT NULL CHECK (btrim(kind) <> ''),
    dedupe_key text NOT NULL CHECK (btrim(dedupe_key) <> ''),
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'leased', 'completed', 'dead')),
    available_at timestamptz NOT NULL,
    attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    max_attempts integer NOT NULL CHECK (max_attempts > 0),
    leased_by text,
    leased_until timestamptz,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (kind, dedupe_key),
    CHECK (
        (status = 'leased' AND leased_by IS NOT NULL AND leased_until IS NOT NULL)
        OR (status <> 'leased' AND leased_by IS NULL AND leased_until IS NULL)
    ),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX jobs_claim_idx
    ON jobs (available_at, id)
    WHERE status IN ('ready', 'leased');

CREATE TABLE outbox (
    id uuid PRIMARY KEY,
    topic text NOT NULL CHECK (btrim(topic) <> ''),
    aggregate_id uuid NOT NULL,
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz
);

CREATE INDEX outbox_pending_idx ON outbox (created_at, id) WHERE delivered_at IS NULL;

CREATE TABLE operator_incidents (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES sources(id),
    collection_run_id uuid REFERENCES collection_runs(id),
    health_code text NOT NULL,
    state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'resolved')),
    summary text NOT NULL CHECK (octet_length(summary) <= 4096),
    opened_at timestamptz NOT NULL,
    acknowledged_at timestamptz,
    resolved_at timestamptz,
    replay_run_id uuid REFERENCES collection_runs(id),
    CHECK ((state = 'open' AND acknowledged_at IS NULL AND resolved_at IS NULL)
        OR (state = 'acknowledged' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL)
        OR (state = 'resolved' AND resolved_at IS NOT NULL))
);

CREATE INDEX operator_incidents_open_idx
    ON operator_incidents (opened_at, id)
    WHERE state <> 'resolved';

CREATE TABLE operator_audit_log (
    id uuid PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    trace_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
