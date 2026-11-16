-- Give every requirement and acceptance criterion its own id (ADR-009), so the
-- API removes an item by id instead of by its position in the list.
--
-- Existing rows get a random id. gen_random_uuid() is built into PostgreSQL 13
-- and later and into H2, so the tests run this same file.
--
-- There is no UNIQUE constraint on id. Rows are still keyed by (task_id,
-- position), and when an item is removed Hibernate moves the items after it up
-- by updating each row in place, so for a moment two rows hold the same id.
-- The Domain keeps ids unique instead: new ids are random UUIDs, and
-- Task.restore refuses a task whose items share an id.

ALTER TABLE task_requirements ADD COLUMN id UUID;
UPDATE task_requirements SET id = gen_random_uuid();
ALTER TABLE task_requirements ALTER COLUMN id SET NOT NULL;

ALTER TABLE task_acceptance_criteria ADD COLUMN id UUID;
UPDATE task_acceptance_criteria SET id = gen_random_uuid();
ALTER TABLE task_acceptance_criteria ALTER COLUMN id SET NOT NULL;
