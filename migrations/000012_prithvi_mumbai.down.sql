DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM collection_runs
        WHERE source_id = '7bb2b2bf-66bb-5cfe-8269-ea811552d9c7'
    ) OR EXISTS (
        SELECT 1 FROM event_occurrences
        WHERE source_id = '7bb2b2bf-66bb-5cfe-8269-ea811552d9c7'
    ) THEN
        RAISE EXCEPTION 'cannot remove Prithvi Theatre after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = '7bb2b2bf-66bb-5cfe-8269-ea811552d9c7';

UPDATE cities
SET enabled = false
WHERE id = '7eb386b1-1bf5-5cd4-828f-a288683eef55'
  AND NOT EXISTS (
      SELECT 1 FROM sources
      WHERE city_id = '7eb386b1-1bf5-5cd4-828f-a288683eef55'
        AND enabled
  );
