# Modern PostgreSQL Practices

> Target: PostgreSQL 17+ (PlanetScale native PostgreSQL)

## Extensions

PlanetScale PostgreSQL supports commonly used extensions. The schema leverages:

| Extension | Purpose | Used For |
|-----------|---------|----------|
| `uuid-ossp` | UUID generation | Primary keys (`uuid_generate_v4()`) |
| `pg_trgm` | Trigram similarity | Future: fuzzy search on filter rule content |

Enable in a migration:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

## Schema Design Practices

### UUID Primary Keys

All tables use `UUID` primary keys instead of auto-incrementing integers:
- No sequential enumeration attacks
- Safe for distributed inserts (Workers in multiple regions)
- Mergeable across database branches without ID conflicts

### JSONB for Flexible Data

`compiled_outputs.config_snapshot` uses `JSONB`:
- Query individual fields: `WHERE config_snapshot->>'name' = 'EasyList'`
- Index specific paths: `CREATE INDEX ON compiled_outputs ((config_snapshot->>'name'))`
- No schema migration needed when config shape evolves

### PostgreSQL Arrays

`api_keys.scopes` uses `TEXT[]` (native array):
- Check scope: `WHERE 'compile' = ANY(scopes)`
- No join table needed for simple RBAC
- Indexable with GIN: `CREATE INDEX ON api_keys USING GIN(scopes)`

### Partial Unique Indexes

`filter_list_versions` uses a partial unique index to enforce "only one current version per source":

```sql
CREATE UNIQUE INDEX idx_filter_list_versions_current
    ON filter_list_versions(source_id)
    WHERE is_current = TRUE;
```

This is a PostgreSQL-specific feature that SQLite and MySQL don't support.

### Timestamptz

All timestamp columns use `TIMESTAMPTZ` (timestamp with time zone) instead of `TIMESTAMP`:
- Stores in UTC internally, converts to client timezone on read
- Prevents timezone confusion between Workers in different regions
- PostgreSQL best practice since v8.0

## Performance Settings

### Connection Pooling

PlanetScale provides built-in connection pooling. Hyperdrive adds a second layer of edge-side pooling. No need for PgBouncer or similar.

Recommended Hyperdrive caching:

```bash
wrangler hyperdrive update <ID> \
    --caching-disabled=false \
    --max-age=60 \
    --stale-while-revalidate=15
```

### Indexes

The schema includes targeted indexes for the most common query patterns:

- `api_keys(key_hash)` — API key lookup on every authenticated request
- `compilation_events(created_at DESC)` — Dashboard analytics, most recent first
- `filter_sources(status)` — Health monitoring queries
- `compiled_outputs(config_hash)` — Cache deduplication by configuration

### Append-Only Tables

`compilation_events` and `source_health_snapshots` are append-only (no UPDATEs). This is optimal for:
- Write performance (no row locking contention)
- Time-series analytics (partition by month if volume grows)
- Audit trail (immutable history)

Future optimization: partition by `created_at` month if table exceeds 10M rows.

## Security

### Row-Level Security (Future)

PostgreSQL supports RLS for multi-tenant isolation:

```sql
ALTER TABLE compiled_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_owns_output ON compiled_outputs
    USING (owner_user_id = current_setting('app.current_user_id')::uuid);
```

This is planned for Phase 4 (authentication) when per-user data isolation is needed.

### Credential Storage

- API keys: only the SHA-256 hash is stored (`key_hash`), never plaintext
- Sessions: only the token hash is stored (`token_hash`)
- The `key_prefix` (first 8 chars) allows users to identify keys in the UI

## References

- [PlanetScale PostgreSQL Compatibility](https://planetscale.com/docs/postgres/postgres-compatibility)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/17/datatype-json.html)
- [PostgreSQL Arrays](https://www.postgresql.org/docs/17/arrays.html)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/17/indexes-partial.html)
