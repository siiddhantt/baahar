DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM collection_runs
        WHERE source_id = '019c5d13-c392-79d2-9012-3ed4242f771f'
    ) OR EXISTS (
        SELECT 1
        FROM event_occurrences
        WHERE source_id = '019c5d13-c392-79d2-9012-3ed4242f771f'
    ) THEN
        RAISE EXCEPTION 'cannot remove launch source after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = '019c5d13-c392-79d2-9012-3ed4242f771f';

DELETE FROM cities
WHERE id IN (
    '019c5d13-c392-79d2-9012-3ed4242f771d',
    '019c5d13-c392-79d2-9012-3ed4242f771e'
)
AND NOT EXISTS (SELECT 1 FROM sources WHERE sources.city_id = cities.id)
AND NOT EXISTS (SELECT 1 FROM venues WHERE venues.city_id = cities.id)
AND NOT EXISTS (SELECT 1 FROM events WHERE events.city_id = cities.id);
