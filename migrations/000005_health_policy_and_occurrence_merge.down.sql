DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM event_occurrences WHERE merged_into_occurrence_id IS NOT NULL
    ) OR EXISTS (
        SELECT 1 FROM source_aliases WHERE merged_occurrence_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'cannot remove occurrence merge state while reviewed merges exist';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM sources
        WHERE NOT (
            (id = '019c5d13-c392-79d2-9012-3ed4242f771f'
                AND maximum_duplicate_ratio_bps = 100
                AND low_count_ratio_bps = 4000
                AND high_count_ratio_bps = 25000)
            OR (id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f'
                AND maximum_duplicate_ratio_bps = 0
                AND low_count_ratio_bps = 5000
                AND high_count_ratio_bps = 20000)
            OR (id NOT IN (
                    '019c5d13-c392-79d2-9012-3ed4242f771f',
                    'de7c8acb-0185-5994-b1b4-290029c3ed5f'
                )
                AND maximum_duplicate_ratio_bps = 0
                AND low_count_ratio_bps = 5000
                AND high_count_ratio_bps = 20000)
        )
    ) THEN
        RAISE EXCEPTION 'cannot remove source health ratios that are not recoverable on reapply';
    END IF;
END $$;

DROP INDEX source_aliases_merged_occurrence_idx;

ALTER TABLE source_aliases
    DROP CONSTRAINT source_aliases_distinct_merge_target_check,
    DROP COLUMN merged_occurrence_id;

DROP INDEX event_occurrences_merged_into_idx;

ALTER TABLE event_occurrences
    DROP CONSTRAINT event_occurrences_no_self_merge_check,
    DROP CONSTRAINT event_occurrences_merge_pair_check,
    DROP COLUMN merged_at,
    DROP COLUMN merged_into_occurrence_id;

ALTER TABLE sources
    DROP CONSTRAINT sources_count_ratio_order_check,
    DROP CONSTRAINT sources_high_count_ratio_check,
    DROP CONSTRAINT sources_low_count_ratio_check,
    DROP CONSTRAINT sources_duplicate_ratio_check,
    DROP COLUMN high_count_ratio_bps,
    DROP COLUMN low_count_ratio_bps,
    DROP COLUMN maximum_duplicate_ratio_bps;
