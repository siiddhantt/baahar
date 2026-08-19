ALTER TABLE sources
    ADD COLUMN maximum_duplicate_ratio_bps integer NOT NULL DEFAULT 0,
    ADD COLUMN low_count_ratio_bps integer NOT NULL DEFAULT 5000,
    ADD COLUMN high_count_ratio_bps integer NOT NULL DEFAULT 20000,
    ADD CONSTRAINT sources_duplicate_ratio_check
        CHECK (maximum_duplicate_ratio_bps BETWEEN 0 AND 10000),
    ADD CONSTRAINT sources_low_count_ratio_check
        CHECK (low_count_ratio_bps BETWEEN 1 AND 10000),
    ADD CONSTRAINT sources_high_count_ratio_check
        CHECK (high_count_ratio_bps BETWEEN 10000 AND 100000),
    ADD CONSTRAINT sources_count_ratio_order_check
        CHECK (low_count_ratio_bps <= high_count_ratio_bps);

UPDATE sources
SET maximum_duplicate_ratio_bps = 100,
    low_count_ratio_bps = 4000,
    high_count_ratio_bps = 25000
WHERE id = '019c5d13-c392-79d2-9012-3ed4242f771f';

UPDATE sources
SET maximum_duplicate_ratio_bps = 0,
    low_count_ratio_bps = 5000,
    high_count_ratio_bps = 20000
WHERE id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f';

ALTER TABLE event_occurrences
    ADD COLUMN merged_into_occurrence_id uuid REFERENCES event_occurrences(id),
    ADD COLUMN merged_at timestamptz,
    ADD CONSTRAINT event_occurrences_merge_pair_check
        CHECK ((merged_into_occurrence_id IS NULL) = (merged_at IS NULL)),
    ADD CONSTRAINT event_occurrences_no_self_merge_check
        CHECK (merged_into_occurrence_id IS NULL OR merged_into_occurrence_id <> id);

CREATE INDEX event_occurrences_merged_into_idx
    ON event_occurrences (merged_into_occurrence_id, id)
    WHERE merged_into_occurrence_id IS NOT NULL;

ALTER TABLE source_aliases
    ADD COLUMN merged_occurrence_id uuid REFERENCES event_occurrences(id),
    ADD CONSTRAINT source_aliases_distinct_merge_target_check
        CHECK (merged_occurrence_id IS NULL OR merged_occurrence_id <> occurrence_id);

CREATE UNIQUE INDEX source_aliases_merged_occurrence_idx
    ON source_aliases (merged_occurrence_id)
    WHERE merged_occurrence_id IS NOT NULL;
