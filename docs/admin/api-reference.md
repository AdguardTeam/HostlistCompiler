# API Reference

All admin endpoints are mounted under `/admin/system/` and require a valid Clerk JWT with `publicMetadata.role === 'admin'`. Each endpoint additionally requires a specific permission resolved from the caller's admin role in ADMIN_DB.

**Base URL**: `https://your-worker.workers.dev`

**Authentication**: All requests require `Authorization: Bearer <clerk_jwt>`.

---

## Roles

### List Roles

```
GET /admin/system/roles
```

**Permission**: `admin:read`

**Response** `200`:
```json
{
  "success": true,
  "roles": [
    {
      "id": 1,
      "role_name": "viewer",
      "display_name": "Viewer",
      "description": "Read-only access to admin dashboards and logs",
      "permissions": "[\"admin:read\",\"audit:read\",\"metrics:read\",\"config:read\",\"users:read\",\"flags:read\"]",
      "is_active": 1,
      "created_at": "2025-01-01T00:00:00",
      "updated_at": "2025-01-01T00:00:00"
    }
  ]
}
```

---

### Create Role

```
POST /admin/system/roles
```

**Permission**: `roles:write`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role_name` | string | ✅ | Unique role identifier (e.g. `flag-manager`) |
| `display_name` | string | ✅ | Human-readable name |
| `description` | string | | Role description |
| `permissions` | string[] | ✅ | Array of permission strings (min 1) |

```bash
curl -X POST /admin/system/roles \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "role_name": "flag-manager",
    "display_name": "Flag Manager",
    "description": "Manages feature flags only",
    "permissions": ["admin:read", "flags:read", "flags:write"]
  }'
```

**Response** `201`:
```json
{
  "success": true,
  "role": { "id": 4, "role_name": "flag-manager", "..." : "..." }
}
```

---

### Update Role

```
PATCH /admin/system/roles/:id
```

**Permission**: `roles:write`

**Path Parameters**: `id` — Role ID (integer)

**Request Body** (all fields optional):
| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | Updated display name |
| `description` | string | Updated description |
| `permissions` | string[] | Replace permission array (min 1) |
| `is_active` | boolean | Enable/disable the role |

**Response** `200`:
```json
{
  "success": true,
  "role": { "id": 4, "role_name": "flag-manager", "..." : "..." }
}
```

---

### List Role Assignments

```
GET /admin/system/roles/assignments
```

**Permission**: `admin:read`

**Query Parameters** (all optional):
| Param | Type | Description |
|-------|------|-------------|
| `clerk_user_id` | string | Filter by user |
| `role_name` | string | Filter by role |

```bash
curl "/admin/system/roles/assignments?role_name=editor" \
  -H "Authorization: Bearer $JWT"
```

**Response** `200`:
```json
{
  "success": true,
  "assignments": [
    {
      "id": 1,
      "clerk_user_id": "user_2abc123",
      "role_name": "editor",
      "assigned_by": "user_2xyz789",
      "assigned_at": "2025-01-15T10:30:00",
      "expires_at": null
    }
  ]
}
```

---

### Assign Role

```
POST /admin/system/roles/assign
```

**Permission**: `roles:assign`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clerk_user_id` | string | ✅ | Clerk user ID to assign the role to |
| `role_name` | string | ✅ | Role to assign (`viewer`, `editor`, `super-admin`, or custom) |
| `expires_at` | string | | ISO 8601 expiry date (null = never expires) |

```bash
curl -X POST /admin/system/roles/assign \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "clerk_user_id": "user_2abc123",
    "role_name": "editor",
    "expires_at": "2025-12-31T23:59:59Z"
  }'
```

**Response** `200`:
```json
{
  "success": true,
  "assignment": {
    "clerk_user_id": "user_2abc123",
    "role_name": "editor",
    "assigned_by": "user_2xyz789",
    "expires_at": "2025-12-31T23:59:59Z"
  }
}
```

> Uses `INSERT ... ON CONFLICT ... DO UPDATE` — re-assigning updates the existing assignment.

---

### Revoke Role

```
DELETE /admin/system/roles/revoke
```

**Permission**: `roles:assign`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clerk_user_id` | string | ✅ | User to revoke from |
| `role_name` | string | ✅ | Role to revoke |

```bash
curl -X DELETE /admin/system/roles/revoke \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "clerk_user_id": "user_2abc123",
    "role_name": "editor"
  }'
```

**Response** `200`:
```json
{ "success": true, "message": "Role revoked" }
```

> KV cache for the user is invalidated automatically.

---

## My Context

### Get My Context

```
GET /admin/system/my-context
```

**Permission**: None required (returns the caller's own context)

Returns the full dashboard context for the authenticated admin, including role, permissions, tiers, scopes, flags, and active announcements.

```bash
curl /admin/system/my-context -H "Authorization: Bearer $JWT"
```

**Response** `200`:
```json
{
  "success": true,
  "context": {
    "clerk_user_id": "user_2abc123",
    "role_name": "super-admin",
    "permissions": ["admin:read", "admin:write", "..."],
    "expires_at": null
  }
}
```

---

### Get My Permissions

```
GET /admin/system/my-permissions
```

**Permission**: None required

Returns only the caller's resolved permissions array.

---

## Tiers

### List Tiers

```
GET /admin/system/tiers
```

**Permission**: `admin:read`

**Response** `200`:
```json
{
  "success": true,
  "tiers": [
    {
      "id": 1,
      "tier_name": "anonymous",
      "order_rank": 0,
      "rate_limit": 10,
      "display_name": "Anonymous",
      "description": "Unauthenticated user — basic access",
      "features": "{\"maxSources\": 3, \"maxBatchSize\": 1}",
      "is_active": 1,
      "created_at": "2025-01-01T00:00:00",
      "updated_at": "2025-01-01T00:00:00"
    }
  ]
}
```

---

### Update Tier

```
PUT /admin/system/tiers/:name
```

**Permission**: `config:write`

**Path Parameters**: `name` — Tier name (e.g. `free`, `pro`)

**Request Body** (all fields optional):
| Field | Type | Description |
|-------|------|-------------|
| `rate_limit` | number | Requests per minute (0 = unlimited) |
| `display_name` | string | Human-readable name |
| `description` | string | Tier description |
| `features` | object | JSON feature flags/capabilities |
| `is_active` | boolean | Enable/disable the tier |

```bash
curl -X PUT /admin/system/tiers/pro \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "rate_limit": 500,
    "features": {"maxSources": 100, "maxBatchSize": 50, "priorityQueue": true}
  }'
```

**Response** `200`:
```json
{ "success": true, "tier": { "tier_name": "pro", "..." : "..." } }
```

---

### Delete Tier

```
DELETE /admin/system/tiers/:name
```

**Permission**: `config:write`

**Path Parameters**: `name` — Tier name

**Response** `200`:
```json
{ "success": true, "message": "Tier deleted" }
```

---

## Scopes

### List Scopes

```
GET /admin/system/scopes
```

**Permission**: `admin:read`

**Response** `200`:
```json
{
  "success": true,
  "scopes": [
    {
      "id": 1,
      "scope_name": "compile",
      "display_name": "Compile",
      "description": "Compile and download filter lists",
      "required_tier": "free",
      "is_active": 1
    }
  ]
}
```

---

### Update Scope

```
PUT /admin/system/scopes/:name
```

**Permission**: `config:write`

**Path Parameters**: `name` — Scope name (e.g. `compile`, `rules`)

**Request Body** (all fields optional):
| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | Human-readable name |
| `description` | string | Scope description |
| `required_tier` | string | Minimum tier required (`anonymous`, `free`, `pro`, `admin`) |
| `is_active` | boolean | Enable/disable the scope |

```bash
curl -X PUT /admin/system/scopes/compile \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{ "required_tier": "pro" }'
```

---

### Delete Scope

```
DELETE /admin/system/scopes/:name
```

**Permission**: `config:write`

---

## Endpoint Auth Overrides

Per-endpoint authentication requirements that override the global defaults.

### List Endpoint Overrides

```
GET /admin/system/endpoints
```

**Permission**: `admin:read`

**Response** `200`:
```json
{
  "success": true,
  "endpoints": [
    {
      "id": 1,
      "path_pattern": "/api/rules/*",
      "method": "*",
      "required_tier": "pro",
      "required_scopes": "[\"rules\"]",
      "is_public": 0,
      "is_active": 1
    }
  ]
}
```

---

### Create Endpoint Override

```
POST /admin/system/endpoints
```

**Permission**: `config:write`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path_pattern` | string | ✅ | URL pattern (e.g. `/compile`, `/api/rules/*`) |
| `method` | string | | HTTP method or `*` for all (default: `*`) |
| `required_tier` | string | | Tier override (null = use default) |
| `required_scopes` | string[] | | Scope overrides (null = use default) |
| `is_public` | boolean | | `true` = no auth required |

```bash
curl -X POST /admin/system/endpoints \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "path_pattern": "/api/public/health",
    "method": "GET",
    "is_public": true
  }'
```

---

### Update Endpoint Override

```
PUT /admin/system/endpoints/:id
```

**Permission**: `config:write`

**Path Parameters**: `id` — Override ID (integer)

**Request Body** (all fields optional):
| Field | Type | Description |
|-------|------|-------------|
| `required_tier` | string | Updated tier requirement |
| `required_scopes` | string[] | Updated scope requirements |
| `is_public` | boolean | Toggle public access |
| `is_active` | boolean | Enable/disable the override |

---

### Delete Endpoint Override

```
DELETE /admin/system/endpoints/:id
```

**Permission**: `config:write`

---

## Feature Flags

### List Flags

```
GET /admin/system/flags
```

**Permission**: `admin:read`

**Response** `200`:
```json
{
  "success": true,
  "flags": [
    {
      "id": 1,
      "flag_name": "new-parser-v2",
      "enabled": 1,
      "rollout_percentage": 25,
      "target_tiers": "[\"pro\",\"admin\"]",
      "target_users": "[]",
      "description": "New AGTree v2 parser",
      "created_by": "user_2abc123",
      "created_at": "2025-01-15T10:30:00",
      "updated_at": "2025-01-15T10:30:00"
    }
  ]
}
```

---

### Create Flag

```
POST /admin/system/flags
```

**Permission**: `flags:write`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flag_name` | string | ✅ | Unique flag identifier |
| `enabled` | boolean | | Default: `false` |
| `rollout_percentage` | number | | 0–100, default: `100` |
| `target_tiers` | string[] | | Tier filter (empty = all tiers) |
| `target_users` | string[] | | Clerk user IDs for user-level targeting |
| `description` | string | | Human-readable description |

```bash
curl -X POST /admin/system/flags \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "flag_name": "streaming-api-beta",
    "enabled": true,
    "rollout_percentage": 10,
    "target_tiers": ["pro", "admin"],
    "description": "Server-sent events streaming API"
  }'
```

---

### Update Flag

```
PATCH /admin/system/flags/:id
```

**Permission**: `flags:write`

**Path Parameters**: `id` — Flag ID (integer)

**Request Body**: Same fields as create, all optional.

---

### Delete Flag

```
DELETE /admin/system/flags/:id
```

**Permission**: `flags:write`

---

## Audit Logs

### Query Audit Logs

```
GET /admin/system/audit
```

**Permission**: `audit:read`

**Query Parameters** (all optional):
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `actor_id` | string | | Filter by Clerk user ID |
| `action` | string | | Filter by action (e.g. `tier.update`) |
| `resource_type` | string | | Filter by resource type (e.g. `feature_flag`) |
| `resource_id` | string | | Filter by specific resource ID |
| `status` | string | | `success`, `failure`, or `denied` |
| `since` | string | | ISO 8601 start date |
| `until` | string | | ISO 8601 end date |
| `limit` | number | 50 | Results per page (max 100) |
| `offset` | number | 0 | Pagination offset |

```bash
curl "/admin/system/audit?action=tier.update&since=2025-01-01T00:00:00Z&limit=20" \
  -H "Authorization: Bearer $JWT"
```

**Response** `200`:
```json
{
  "success": true,
  "logs": [
    {
      "id": 42,
      "actor_id": "user_2abc123",
      "actor_email": "admin@example.com",
      "action": "tier.update",
      "resource_type": "tier_config",
      "resource_id": "pro",
      "old_values": "{\"rate_limit\": 300}",
      "new_values": "{\"rate_limit\": 500}",
      "ip_address": "203.0.113.1",
      "user_agent": "Mozilla/5.0...",
      "status": "success",
      "metadata": null,
      "created_at": "2025-01-15T10:30:00"
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0
}
```

---

## Announcements

### List Announcements

```
GET /admin/system/announcements
```

**Permission**: `admin:read`

**Response** `200`:
```json
{
  "success": true,
  "announcements": [
    {
      "id": 1,
      "title": "Scheduled Maintenance",
      "body": "The platform will be briefly unavailable on Jan 20 from 02:00-04:00 UTC.",
      "severity": "warning",
      "active_from": "2025-01-18T00:00:00",
      "active_until": "2025-01-20T04:00:00",
      "is_active": 1,
      "created_by": "user_2abc123",
      "created_at": "2025-01-15T10:30:00",
      "updated_at": "2025-01-15T10:30:00"
    }
  ]
}
```

---

### Create Announcement

```
POST /admin/system/announcements
```

**Permission**: `config:write`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Announcement title |
| `body` | string | | Announcement body (supports markdown) |
| `severity` | string | | `info`, `warning`, `error`, or `success` (default: `info`) |
| `active_from` | string | | ISO 8601 start time (null = immediately) |
| `active_until` | string | | ISO 8601 end time (null = no expiry) |

```bash
curl -X POST /admin/system/announcements \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Parser Available",
    "body": "AGTree v2 is now available for all Pro users.",
    "severity": "success",
    "active_until": "2025-02-01T00:00:00Z"
  }'
```

---

### Update Announcement

```
PATCH /admin/system/announcements/:id
```

**Permission**: `config:write`

**Path Parameters**: `id` — Announcement ID (integer)

**Request Body**: Same fields as create, all optional. Additionally:
| Field | Type | Description |
|-------|------|-------------|
| `is_active` | boolean | Enable/disable the announcement |

---

### Delete Announcement

```
DELETE /admin/system/announcements/:id
```

**Permission**: `config:write`

---

## Endpoint Summary

| # | Method | Path | Permission |
|---|--------|------|------------|
| 1 | GET | `/admin/system/roles` | `admin:read` |
| 2 | POST | `/admin/system/roles` | `roles:write` |
| 3 | PATCH | `/admin/system/roles/:id` | `roles:write` |
| 4 | GET | `/admin/system/roles/assignments` | `admin:read` |
| 5 | POST | `/admin/system/roles/assign` | `roles:assign` |
| 6 | DELETE | `/admin/system/roles/revoke` | `roles:assign` |
| 7 | GET | `/admin/system/my-context` | _(none)_ |
| 8 | GET | `/admin/system/my-permissions` | _(none)_ |
| 9 | GET | `/admin/system/tiers` | `admin:read` |
| 10 | PUT | `/admin/system/tiers/:name` | `config:write` |
| 11 | DELETE | `/admin/system/tiers/:name` | `config:write` |
| 12 | GET | `/admin/system/scopes` | `admin:read` |
| 13 | PUT | `/admin/system/scopes/:name` | `config:write` |
| 14 | DELETE | `/admin/system/scopes/:name` | `config:write` |
| 15 | GET | `/admin/system/endpoints` | `admin:read` |
| 16 | POST | `/admin/system/endpoints` | `config:write` |
| 17 | PUT | `/admin/system/endpoints/:id` | `config:write` |
| 18 | DELETE | `/admin/system/endpoints/:id` | `config:write` |
| 19 | GET | `/admin/system/flags` | `admin:read` |
| 20 | POST | `/admin/system/flags` | `flags:write` |
| 21 | PATCH | `/admin/system/flags/:id` | `flags:write` |
| 22 | DELETE | `/admin/system/flags/:id` | `flags:write` |
| 23 | GET | `/admin/system/audit` | `audit:read` |
| 24 | GET | `/admin/system/announcements` | `admin:read` |
| 25 | POST | `/admin/system/announcements` | `config:write` |
| 26 | PATCH | `/admin/system/announcements/:id` | `config:write` |
| 27 | DELETE | `/admin/system/announcements/:id` | `config:write` |
