ALTER TABLE event_versions
DROP CONSTRAINT event_versions_category_check;

ALTER TABLE event_versions
ADD CONSTRAINT event_versions_category_check
CHECK (category IN ('arts', 'talks', 'workshops', 'theatre', 'music', 'books', 'community', 'other'));
