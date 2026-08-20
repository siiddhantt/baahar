DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM collection_runs
        WHERE source_id = '7129ebd4-8cc9-524f-85bd-f9cde8b6d7b3'
    ) OR EXISTS (
        SELECT 1 FROM event_occurrences
        WHERE source_id = '7129ebd4-8cc9-524f-85bd-f9cde8b6d7b3'
    ) THEN
        RAISE EXCEPTION 'cannot remove The Piano Man after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = '7129ebd4-8cc9-524f-85bd-f9cde8b6d7b3';

UPDATE cities
SET enabled = false
WHERE id = '19f16354-f054-53e8-bfb6-2b1e1acdcd00'
  AND NOT EXISTS (
      SELECT 1 FROM sources
      WHERE city_id = '19f16354-f054-53e8-bfb6-2b1e1acdcd00'
        AND enabled
  );
