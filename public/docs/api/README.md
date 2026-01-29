# Adblock Compiler API

**Version:** 2.0.0

## Description

**Compiler-as-a-Service** for adblock filter lists. Transform, optimize, and combine filter lists from multiple sources with real-time progress tracking.

## Features
- 🎯 Multi-Source Compilation
- ⚡ Performance (Gzip compression, caching, request deduplication)
- 🔄 Circuit Breaker with retry logic
- 📊 Visual Diff between compilations
- 📡 Real-time progress via SSE and WebSocket
- 🎪 Batch Processing
- 🌍 Universal (Deno, Node.js, Cloudflare Workers, browsers)

## Links
- [GitHub Repository](https://github.com/jaypatrick/adblock-compiler)
- [Documentation](https://github.com/jaypatrick/adblock-compiler/tree/master/docs)
- [Web UI](https://adblock-compiler.jayson-knight.workers.dev/)


## Servers

- **Production server**: `https://adblock-compiler.jayson-knight.workers.dev`
- **Local development server**: `http://localhost:8787`

## Endpoints

### Metrics

#### `GET /api`

**Summary:** Get API information

Returns API version, available endpoints, and usage examples

**Operation ID:** `getApiInfo`

**Responses:**

- `200`: API information

---

#### `GET /metrics`

**Summary:** Get performance metrics

Returns aggregated metrics for the last 30 minutes

**Operation ID:** `getMetrics`

**Responses:**

- `200`: Performance metrics

---

### Compilation

#### `POST /compile`

**Summary:** Compile filter list (JSON)

Compile filter lists and return results as JSON. Results are cached for 1 hour.
Supports request deduplication for concurrent identical requests.


**Operation ID:** `compileJson`

**Request Body:**

- Content-Type: `application/json`
  - Schema: [`CompileRequest`](#compilerequest)

**Responses:**

- `200`: Compilation successful
- `429`: No description
- `500`: No description

---

#### `POST /compile/batch`

**Summary:** Batch compile multiple lists

Compile multiple filter lists in parallel (max 10 per batch)

**Operation ID:** `compileBatch`

**Request Body:**

- Content-Type: `application/json`
  - Schema: [`BatchCompileRequest`](#batchcompilerequest)

**Responses:**

- `200`: Batch compilation results
- `400`: Invalid batch request
- `429`: No description

---

### Streaming

#### `POST /compile/stream`

**Summary:** Compile with real-time progress (SSE)

Compile filter lists with real-time progress updates via Server-Sent Events.
Streams events including source downloads, transformations, diagnostics, cache operations, network events, and metrics.


**Operation ID:** `compileStream`

**Request Body:**

- Content-Type: `application/json`
  - Schema: [`CompileRequest`](#compilerequest)

**Responses:**

- `200`: Event stream
- `429`: No description

---

### Queue

#### `POST /compile/async`

**Summary:** Queue async compilation job

Queue a compilation job for asynchronous processing. Returns immediately with a request ID.
Use GET /queue/results/{requestId} to retrieve results when complete.


**Operation ID:** `compileAsync`

**Request Body:**

- Content-Type: `application/json`
  - Schema: [`CompileRequest`](#compilerequest)

**Responses:**

- `202`: Job queued successfully
- `500`: Queue not available

---

#### `POST /compile/batch/async`

**Summary:** Queue batch async compilation

Queue multiple compilations for async processing

**Operation ID:** `compileBatchAsync`

**Request Body:**

- Content-Type: `application/json`
  - Schema: [`BatchCompileRequest`](#batchcompilerequest)

**Responses:**

- `202`: Batch queued successfully

---

#### `GET /queue/stats`

**Summary:** Get queue statistics

Returns queue health metrics and job statistics

**Operation ID:** `getQueueStats`

**Responses:**

- `200`: Queue statistics

---

#### `GET /queue/results/{requestId}`

**Summary:** Get async job results

Retrieve results for a completed async compilation job

**Operation ID:** `getQueueResults`

**Parameters:**

- `requestId` (path) (required): Request ID returned from async endpoints

**Responses:**

- `200`: Job results
- `404`: Job not found

---

### WebSocket

#### `GET /ws/compile`

**Summary:** WebSocket endpoint for real-time compilation

Bidirectional WebSocket connection for real-time compilation with event streaming.

**Client → Server Messages:**
- `compile` - Start compilation
- `cancel` - Cancel running compilation
- `ping` - Heartbeat ping

**Server → Client Messages:**
- `welcome` - Connection established
- `pong` - Heartbeat response
- `compile:started` - Compilation started
- `event` - Compilation event (source, transformation, progress, diagnostic, cache, network, metric)
- `compile:complete` - Compilation finished successfully
- `compile:error` - Compilation failed
- `compile:cancelled` - Compilation cancelled
- `error` - Error message

**Features:**
- Up to 3 concurrent compilations per connection
- Automatic heartbeat (30s interval)
- Connection timeout (5 minutes idle)
- Session-based compilation tracking
- Cancellation support


**Operation ID:** `websocketCompile`

**Responses:**

- `101`: WebSocket connection established
- `426`: Upgrade required (not a WebSocket request)

---

## Schemas

### CompileRequest

**Properties:**

- `configuration` (required): `Configuration` - 
- `preFetchedContent`: `object` - Map of source keys to pre-fetched content
- `benchmark`: `boolean` - Include detailed performance metrics
- `turnstileToken`: `string` - Cloudflare Turnstile token (if enabled)

---

### Configuration

**Properties:**

- `name` (required): `string` - Name of the compiled list
- `description`: `string` - Description of the list
- `homepage`: `string` - Homepage URL
- `license`: `string` - License identifier
- `version`: `string` - Version string
- `sources` (required): `array` - 
- `transformations`: `array` - Global transformations to apply
- `exclusions`: `array` - Rules to exclude (supports wildcards and regex)
- `exclusions_sources`: `array` - Files containing exclusion rules
- `inclusions`: `array` - Rules to include (supports wildcards and regex)
- `inclusions_sources`: `array` - Files containing inclusion rules

---

### Source

**Properties:**

- `source` (required): `string` - URL or key for pre-fetched content
- `name`: `string` - Name of the source
- `type`: `string` - Source type
- `transformations`: `array` - 
- `exclusions`: `array` - 
- `inclusions`: `array` - 

---

### Transformation

Available transformations (applied in this order):
- **ConvertToAscii**: Convert internationalized domains to ASCII
- **RemoveComments**: Remove comment lines
- **Compress**: Convert hosts format to adblock syntax
- **RemoveModifiers**: Strip unsupported modifiers
- **Validate**: Remove invalid/dangerous rules
- **ValidateAllowIp**: Like Validate but keeps IP addresses
- **Deduplicate**: Remove duplicate rules
- **InvertAllow**: Convert blocking rules to allowlist
- **RemoveEmptyLines**: Remove blank lines
- **TrimLines**: Remove leading/trailing whitespace
- **InsertFinalNewLine**: Add final newline


**Enum values:**

- `ConvertToAscii`
- `RemoveComments`
- `Compress`
- `RemoveModifiers`
- `Validate`
- `ValidateAllowIp`
- `Deduplicate`
- `InvertAllow`
- `RemoveEmptyLines`
- `TrimLines`
- `InsertFinalNewLine`

---

### BatchCompileRequest

**Properties:**

- `requests` (required): `array` - 

---

### BatchRequestItem

**Properties:**

- `id` (required): `string` - Unique request identifier
- `configuration` (required): `Configuration` - 
- `preFetchedContent`: `object` - 
- `benchmark`: `boolean` - 

---

### CompileResponse

**Properties:**

- `success` (required): `boolean` - 
- `rules`: `array` - Compiled filter rules
- `ruleCount`: `integer` - Number of rules
- `metrics`: `CompilationMetrics` - 
- `compiledAt`: `string` - 
- `previousVersion`: `PreviousVersion` - 
- `cached`: `boolean` - Whether result was served from cache
- `deduplicated`: `boolean` - Whether request was deduplicated
- `error`: `string` - Error message if success=false

---

### CompilationMetrics

**Properties:**

- `totalDurationMs`: `integer` - 
- `sourceCount`: `integer` - 
- `ruleCount`: `integer` - 
- `transformationMetrics`: `array` - 

---

### PreviousVersion

**Properties:**

- `rules`: `array` - 
- `ruleCount`: `integer` - 
- `compiledAt`: `string` - 

---

### BatchCompileResponse

**Properties:**

- `success`: `boolean` - 
- `results`: `array` - 

---

### QueueResponse

**Properties:**

- `success`: `boolean` - 
- `message`: `string` - 
- `requestId`: `string` - 
- `priority`: `string` - 

---

### QueueJobStatus

**Properties:**

- `success`: `boolean` - 
- `status`: `string` - 
- `jobInfo`: `object` - 

---

### QueueStats

**Properties:**

- `pending`: `integer` - 
- `completed`: `integer` - 
- `failed`: `integer` - 
- `cancelled`: `integer` - 
- `totalProcessingTime`: `integer` - 
- `averageProcessingTime`: `integer` - 
- `processingRate`: `number` - Jobs per minute
- `queueLag`: `integer` - Average time in queue (ms)
- `lastUpdate`: `string` - 
- `history`: `array` - 
- `depthHistory`: `array` - 

---

### JobHistoryEntry

**Properties:**

- `requestId`: `string` - 
- `configName`: `string` - 
- `status`: `string` - 
- `duration`: `integer` - 
- `timestamp`: `string` - 
- `error`: `string` - 
- `ruleCount`: `integer` - 

---

### MetricsResponse

**Properties:**

- `window`: `string` - 
- `timestamp`: `string` - 
- `endpoints`: `object` - 

---

### ApiInfo

**Properties:**

- `name`: `string` - 
- `version`: `string` - 
- `endpoints`: `object` - 
- `example`: `object` - 

---

### WsCompileRequest

**Properties:**

- `type` (required): `string` - 
- `sessionId` (required): `string` - 
- `configuration` (required): `Configuration` - 
- `preFetchedContent`: `object` - 
- `benchmark`: `boolean` - 

---

### WsCancelRequest

**Properties:**

- `type` (required): `string` - 
- `sessionId` (required): `string` - 

---

### WsPingMessage

**Properties:**

- `type` (required): `string` - 

---

### WsWelcomeMessage

**Properties:**

- `type` (required): `string` - 
- `version` (required): `string` - 
- `connectionId` (required): `string` - 
- `capabilities` (required): `object` - 

---

### WsPongMessage

**Properties:**

- `type` (required): `string` - 
- `timestamp`: `string` - 

---

### WsCompileStartedMessage

**Properties:**

- `type` (required): `string` - 
- `sessionId` (required): `string` - 
- `configurationName` (required): `string` - 

---

### WsEventMessage

**Properties:**

- `type` (required): `string` - 
- `sessionId` (required): `string` - 
- `eventType` (required): `string` - 
- `data` (required): `object` - 

---

### WsCompileCompleteMessage

**Properties:**

- `type` (required): `string` - 
- `sessionId` (required): `string` - 
- `rules` (required): `array` - 
- `ruleCount` (required): `integer` - 
- `metrics`: `object` - 
- `compiledAt`: `string` - 

---

### WsCompileErrorMessage

**Properties:**

- `type` (required): `string` - 
- `sessionId` (required): `string` - 
- `error` (required): `string` - 
- `details`: `object` - 

---
