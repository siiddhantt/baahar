ALTER TABLE cities
DROP CONSTRAINT cities_accent_check;

ALTER TABLE cities
ADD CONSTRAINT cities_accent_check
CHECK (accent IN ('coast', 'monument', 'rain', 'river'));

INSERT INTO cities (id, slug, display_name, timezone, accent, enabled)
VALUES
    ('19f16354-f054-53e8-bfb6-2b1e1acdcd00', 'delhi', 'Delhi', 'Asia/Kolkata', 'monument', false),
    ('7eb386b1-1bf5-5cd4-828f-a288683eef55', 'mumbai', 'Mumbai', 'Asia/Kolkata', 'coast', false);
