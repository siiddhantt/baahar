DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM collection_runs
        WHERE source_id = '854afb9d-c219-5f8f-b8a5-f0b8b24ae799'
    ) OR EXISTS (
        SELECT 1
        FROM event_occurrences
        WHERE source_id = '854afb9d-c219-5f8f-b8a5-f0b8b24ae799'
    ) THEN
        RAISE EXCEPTION 'cannot remove Atta Galatta after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = '854afb9d-c219-5f8f-b8a5-f0b8b24ae799';
