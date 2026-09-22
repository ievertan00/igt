-- Runtime resource checks have no SQLite reader. Verification remains a
-- stateless command result until a durable consumer is introduced.
DROP TABLE IF EXISTS learning_resource_checks;
