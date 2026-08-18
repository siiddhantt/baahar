DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM collection_runs
        WHERE source_id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f'
    ) OR EXISTS (
        SELECT 1
        FROM event_occurrences
        WHERE source_id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f'
    ) THEN
        RAISE EXCEPTION 'cannot remove Jagriti source after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = 'de7c8acb-0185-5994-b1b4-290029c3ed5f';
