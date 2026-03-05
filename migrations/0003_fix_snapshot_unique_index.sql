-- Fix source_snapshots unique index to allow multiple historical snapshots per source.
--
-- The old composite unique index on (source, isCurrent) incorrectly prevented storing
-- more than one historical (isCurrent = 0) snapshot per source. It is replaced with a
-- partial unique index that enforces only one *current* snapshot per source.

DROP INDEX IF EXISTS idx_source_snapshots_source_isCurrent;

-- Partial unique index: at most one current snapshot per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_snapshots_current ON source_snapshots(source) WHERE isCurrent = 1;
