DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM collection_runs
        WHERE source_id = 'bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd'
    ) OR EXISTS (
        SELECT 1
        FROM event_occurrences
        WHERE source_id = 'bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd'
    ) THEN
        RAISE EXCEPTION 'cannot remove BHU Academic Events after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = 'bd2e0a8f-78fd-5412-b188-d8d8f31b1dbd';

UPDATE cities
SET enabled = false
WHERE id = '019c5d13-c392-79d2-9012-3ed4242f771e'
  AND NOT EXISTS (
      SELECT 1
      FROM sources
      WHERE city_id = '019c5d13-c392-79d2-9012-3ed4242f771e'
        AND enabled
  );
