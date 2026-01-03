# Adblock Compiler API Reference

> **Compiler-as-a-Service**: Transform and optimize adblock filter lists through a simple REST API

## Base URL

**Production**: `https://adblock-compiler.jayson-knight.workers.dev`

**Local Development**: `http://localhost:8787`

## Endpoints

### GET /api

Returns API information, available endpoints, and usage examples.

**Response**:
```json
{
  "name": "Hostlist Compiler Worker",
  "version": "2.0.0",
  "endpoints": {
    "GET /": "Web UI for interactive compilation",
    "GET /api": "API information (this endpoint)",
    "POST /compile": "Compile a filter list (JSON response)",
    "POST /compile/stream": "Compile with real-time progress (SSE)",
    "POST /compile/batch": "Compile multiple filter lists in parallel"
  },
  "example": {
    "method": "POST",
    "url": "/compile",
    "body": { ... }
  }
}
```

---

### POST /compile

Compile filter lists and return results as JSON.

**Request Body**:
```json
{
  "configuration": {
    "name": "My Filter List",
    "description": "Optional description",
    "sources": [
      {
        "name": "Source Name",
        "source": "https://example.com/filters.txt",
        "type": "adblock",
        "transformations": ["RemoveComments", "Validate"]
      }
    ],
    "transformations": ["Deduplicate", "RemoveEmptyLines"],
    "exclusions": ["||example.com^"],
    "inclusions": ["*"]
  },
  "preFetchedContent": {
    "custom-key": "||ads.example.com^\n||tracking.example.com^"
  },
  "benchmark": true
}
```

**Configuration Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Name of the compiled list |
| `description` | string | No | Description of the list |
| `sources` | array | Yes | Array of source configurations |
| `transformations` | array | No | Global transformations to apply |
| `exclusions` | array | No | Rules to exclude (supports wildcards and regex) |
| `exclusions_sources` | array | No | Files containing exclusion rules |
| `inclusions` | array | No | Rules to include (supports wildcards and regex) |
| `inclusions_sources` | array | No | Files containing inclusion rules |

**Source Configuration**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | Yes | URL or key for pre-fetched content |
| `name` | string | No | Name of the source |
| `type` | string | No | `adblock` or `hosts` (default: `adblock`) |
| `transformations` | array | No | Source-specific transformations |
| `exclusions` | array | No | Source-specific exclusions |
| `inclusions` | array | No | Source-specific inclusions |

**Response**:
```json
{
  "success": true,
  "rules": [
    "||ads.example.com^",
    "||tracking.example.com^"
  ],
  "ruleCount": 2,
  "metrics": {
    "totalDurationMs": 1234,
    "sourceCount": 1,
    "ruleCount": 2
  },
  "compiledAt": "2026-01-01T12:00:00.000Z",
  "previousVersion": {
    "rules": [...],
    "ruleCount": 1800,
    "compiledAt": "2026-01-01T11:00:00.000Z"
  }
}
```

**Response Headers**:
- `X-Cache: HIT|MISS` - Indicates if response was served from cache
- `X-Request-Deduplication: HIT` - Present if request was deduplicated with concurrent request

**Error Response**:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

### POST /compile/stream

Compile filter lists with real-time progress updates via Server-Sent Events (SSE).

**Request Body**: Same as `/compile`

**Response**: Server-Sent Events stream

**Event Types**:

#### `log`
```
event: log
data: {"level":"info","message":"Fetching source..."}
```

Levels: `info`, `warn`, `error`, `debug`

#### `source:start`
```
event: source:start
data: {"source":{"name":"Source 1","source":"https://..."},"sourceIndex":0,"totalSources":2}
```

#### `source:complete`
```
event: source:complete
data: {"source":{"name":"Source 1"},"sourceIndex":0,"totalSources":2}
```

#### `source:error`
```
event: source:error
data: {"source":{"name":"Source 1"},"error":"Error message","sourceIndex":0}
```

#### `transformation:start`
```
event: transformation:start
data: {"transformation":"Deduplicate","transformationIndex":0,"totalTransformations":2}
```

#### `transformation:complete`
```
event: transformation:complete
data: {"transformation":"Deduplicate","transformationIndex":0,"totalTransformations":2}
```

#### `progress`
```
event: progress
data: {"phase":"transformations","current":1,"total":2,"message":"Applying transformations"}
```

#### `result`
```
event: result
data: {"rules":["..."],"ruleCount":1234,"metrics":{...}}
```

#### `done`
```
event: done
data: {}
```

#### `error`
```
event: error
data: {"error":"Error message"}
```

---

### POST /compile/batch

Compile multiple filter lists in parallel with a single request.

**Request Body**:
```json
{
  "requests": [
    {
      "id": "list-1",
      "configuration": {
        "name": "First List",
        "sources": [{"source": "https://example.com/list1.txt"}],
        "transformations": ["Deduplicate"]
      },
      "benchmark": true
    },
    {
      "id": "list-2",
      "configuration": {
        "name": "Second List",
        "sources": [{"source": "https://example.com/list2.txt"}],
        "transformations": ["Validate"]
      }
    }
  ]
}
```

**Constraints**:
- Maximum 10 requests per batch
- Each request must have a unique `id`
- All requests processed in parallel

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": "list-1",
      "success": true,
      "rules": [...],
      "ruleCount": 1234,
      "metrics": {...},
      "cached": false
    },
    {
      "id": "list-2",
      "success": true,
      "rules": [...],
      "ruleCount": 567,
      "cached": true
    }
  ]
}
```

**Error Response** (for entire batch):
```json
{
  "success": false,
  "error": "Batch request must contain at least one request"
}
```

**Individual Request Errors**:
```json
{
  "success": true,
  "results": [
    {
      "id": "list-1",
      "success": false,
      "error": "Failed to fetch source"
    },
    {
      "id": "list-2",
      "success": true,
      "rules": [...]
    }
  ]
}
```

---

## Performance Features

### Caching

Compilation results are cached with gzip compression for 1 hour. Cache is automatically invalidated when:
- Configuration changes
- Sources are updated
- Pre-fetched content is used (bypasses cache)

Cache compression typically reduces storage by 70-80%.

### Request Deduplication

Identical concurrent requests are automatically deduplicated. Only one compilation executes, with all requests receiving the same result.

Check `X-Request-Deduplication: HIT` response header to see if your request was deduplicated.

### Circuit Breaker

External source downloads include:
- **Timeout**: 30 seconds per request
- **Retry Logic**: Up to 3 retries with exponential backoff
- **Retry Conditions**: 5xx errors, 429 rate limits, timeouts
- **No Retry**: 4xx client errors (except 429)

---

## Available Transformations

All transformations are applied in the following fixed order:

1. **ConvertToAscii** - Convert internationalized domains to ASCII
2. **TrimLines** - Remove leading/trailing whitespace
3. **RemoveComments** - Remove comment lines
4. **Compress** - Convert hosts format to adblock syntax
5. **RemoveModifiers** - Strip unsupported modifiers
6. **InvertAllow** - Convert blocking rules to allowlist
7. **Validate** - Remove invalid/dangerous rules
8. **ValidateAllowIp** - Like Validate but keeps IP addresses
9. **Deduplicate** - Remove duplicate rules
10. **RemoveEmptyLines** - Remove blank lines
11. **InsertFinalNewLine** - Add final newline

See [Transformations Guide](../guides/transformations.md) for detailed documentation.

---

## Pre-fetched Content

Use `preFetchedContent` to bypass CORS restrictions or provide custom rules:

```json
{
  "configuration": {
    "sources": [
      {
        "source": "my-custom-rules",
        "name": "Custom Rules"
      }
    ]
  },
  "preFetchedContent": {
    "my-custom-rules": "||ads.example.com^\n||tracking.example.com^"
  }
}
```

The `source` field references a key in `preFetchedContent` instead of a URL.

---

## Rate Limits

- **Requests**: 10 requests per minute per IP address
- **Response Size**: Limited by Cloudflare Workers (typically 25MB)
- **Execution Time**: Maximum 50 seconds per request (streaming continues)
- **Batch Requests**: Maximum 10 compilations per batch

**Rate Limit Headers**:
- `429 Too Many Requests` returned when limit exceeded
- `Retry-After: 60` indicates seconds until retry allowed

---

## CORS

All endpoints support CORS with `Access-Control-Allow-Origin: *`

Preflight requests (`OPTIONS`) are handled automatically.

---

## Error Handling

All errors return appropriate HTTP status codes:

- `400 Bad Request` - Invalid configuration
- `500 Internal Server Error` - Compilation failed
- `404 Not Found` - Invalid endpoint

Error responses include a message:
```json
{
  "success": false,
  "error": "Detailed error message"
}
```

---

## Examples

See the [Examples Guide](../guides/examples.md) for detailed usage examples in multiple languages.

---

## Client Libraries

Currently, the API is REST-based and works with any HTTP client. Community libraries:

- JavaScript/TypeScript: Use `fetch()` or `axios`
- Python: Use `requests` or `httpx`
- Go: Use `net/http`
- Rust: Use `reqwest`

See [Client Examples](../guides/clients.md) for code samples.

---

## Support

- **GitHub Issues**: [jaypatrick/hostlistcompiler](https://github.com/jaypatrick/hostlistcompiler/issues)
- **Documentation**: [docs/](../)
- **Web UI**: [https://adblock-compiler.jayson-knight.workers.dev/](https://adblock-compiler.jayson-knight.workers.dev/)
