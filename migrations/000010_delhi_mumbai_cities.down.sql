DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sources
        WHERE city_id IN (
            '19f16354-f054-53e8-bfb6-2b1e1acdcd00',
            '7eb386b1-1bf5-5cd4-828f-a288683eef55'
        )
    ) THEN
        RAISE EXCEPTION 'cannot remove Delhi or Mumbai while a source still references either city';
    END IF;
END $$;

DELETE FROM cities
WHERE id IN (
    '19f16354-f054-53e8-bfb6-2b1e1acdcd00',
    '7eb386b1-1bf5-5cd4-828f-a288683eef55'
);

ALTER TABLE cities
DROP CONSTRAINT cities_accent_check;

ALTER TABLE cities
ADD CONSTRAINT cities_accent_check
CHECK (accent IN ('rain', 'river'));
