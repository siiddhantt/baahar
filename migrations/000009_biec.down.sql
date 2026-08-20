DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM collection_runs
        WHERE source_id = '520e6232-ab55-5c71-8918-bb68a659ae61'
    ) OR EXISTS (
        SELECT 1
        FROM event_occurrences
        WHERE source_id = '520e6232-ab55-5c71-8918-bb68a659ae61'
    ) THEN
        RAISE EXCEPTION 'cannot remove BIEC after collection data exists';
    END IF;
END $$;

DELETE FROM sources
WHERE id = '520e6232-ab55-5c71-8918-bb68a659ae61';
