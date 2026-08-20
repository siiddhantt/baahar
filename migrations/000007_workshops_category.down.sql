DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM event_versions
        WHERE category = 'workshops'
    ) THEN
        RAISE EXCEPTION 'cannot remove workshops category while event versions use it';
    END IF;
END $$;

ALTER TABLE event_versions
DROP CONSTRAINT event_versions_category_check;

ALTER TABLE event_versions
ADD CONSTRAINT event_versions_category_check
CHECK (category IN ('arts', 'talks', 'theatre', 'music', 'books', 'community', 'other'));
