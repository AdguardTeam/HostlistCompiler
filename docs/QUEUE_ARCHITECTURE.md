# Cloudflare Queue Architecture

This document describes the architecture of the Cloudflare Queue integration for asynchronous filter list compilation.

## Queue Flow Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        CLIENT[Client/Browser]
    end

    subgraph "API Endpoints"
        ASYNC_EP[POST /compile/async]
        BATCH_EP[POST /compile/batch/async]
        SYNC_EP[POST /compile]
    end

    subgraph "Queue Producer"
        ENQUEUE[Queue Message Producer]
        GEN_ID[Generate Request ID]
        CREATE_MSG[Create Queue Message]
    end

    subgraph "Cloudflare Queue"
        QUEUE[(adblock-compiler-worker-queue)]
        QUEUE_BATCH[Message Batching<br/>max_batch_size: 10<br/>max_batch_timeout: 5s]
    end

    subgraph "Queue Consumer"
        CONSUMER[Queue Consumer Handler]
        DISPATCHER[Message Type Dispatcher]
        COMPILE_PROC[Process Compile Message]
        BATCH_PROC[Process Batch Message]
        CACHE_PROC[Process Cache Warm Message]
        CHUNK_PROC[Chunk Processor<br/>Concurrency: 3]
    end

    subgraph "Compilation Layer"
        COMPILER[WorkerCompiler]
        TRACING[Tracing Context]
        DIAGNOSTICS[Diagnostics Collector]
    end

    subgraph "Storage Layer"
        KV_CACHE[(KV: COMPILATION_CACHE<br/>TTL: 1 hour)]
        KV_METRICS[(KV: METRICS<br/>Aggregation: 5 min)]
        COMPRESS[Gzip Compression<br/>~70-80% reduction]
    end

    subgraph "Monitoring Layer"
        TAIL[Tail Worker]
        CONSOLE[Console Logs]
        ANALYTICS[Analytics Engine]
    end

    CLIENT -->|POST request| ASYNC_EP
    CLIENT -->|POST request| BATCH_EP
    CLIENT -->|GET cached result| SYNC_EP

    ASYNC_EP -->|Single compilation| ENQUEUE
    BATCH_EP -->|Batch compilations| ENQUEUE

    ENQUEUE --> GEN_ID
    GEN_ID --> CREATE_MSG
    CREATE_MSG -->|send()| QUEUE

    QUEUE --> QUEUE_BATCH
    QUEUE_BATCH -->|Batched messages| CONSUMER

    CONSUMER --> DISPATCHER
    DISPATCHER -->|type: 'compile'| COMPILE_PROC
    DISPATCHER -->|type: 'batch-compile'| BATCH_PROC
    DISPATCHER -->|type: 'cache-warm'| CACHE_PROC

    COMPILE_PROC --> COMPILER
    BATCH_PROC --> CHUNK_PROC
    CACHE_PROC --> CHUNK_PROC
    CHUNK_PROC --> COMPILE_PROC

    COMPILER --> TRACING
    COMPILER --> DIAGNOSTICS

    COMPILE_PROC --> COMPRESS
    COMPRESS --> KV_CACHE

    COMPILE_PROC -->|Metrics| KV_METRICS
    COMPILE_PROC -->|Diagnostics| TAIL
    COMPILE_PROC -->|Logs| CONSOLE

    SYNC_EP -.->|Read cache| KV_CACHE

    DIAGNOSTICS -.->|Events| TAIL
    CONSOLE -.->|Stream| TAIL
    TAIL -.->|Process logs| ANALYTICS

    style QUEUE fill:#f9f,stroke:#333,stroke-width:4px
    style CONSUMER fill:#bbf,stroke:#333,stroke-width:4px
    style KV_CACHE fill:#bfb,stroke:#333,stroke-width:2px
    style COMPILER fill:#fbb,stroke:#333,stroke-width:2px
```

## Message Types Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API Endpoint
    participant Q as Queue
    participant QC as Queue Consumer
    participant Comp as Compiler
    participant Cache as KV Cache

    Note over C,Cache: Single Compile Flow

    C->>API: POST /compile/async
    API->>API: Generate Request ID
    API->>Q: Send CompileQueueMessage
    API-->>C: 202 Accepted (requestId)

    Q->>QC: Deliver message batch
    QC->>QC: Dispatch by type
    QC->>Comp: Execute compilation
    Comp->>Comp: Apply transformations
    Comp-->>QC: Compiled rules + metrics
    QC->>Cache: Store compressed result
    QC->>Q: ACK message

    Note over C,Cache: Batch Compile Flow

    C->>API: POST /compile/batch/async
    API->>API: Generate Request ID
    API->>Q: Send BatchCompileQueueMessage
    API-->>C: 202 Accepted (requestId, batchSize)

    Q->>QC: Deliver message batch
    QC->>QC: Process in chunks (3)
    loop Each chunk
        QC->>Comp: Compile (parallel up to 3)
        Comp-->>QC: Results
        QC->>Cache: Store results
    end
    QC->>Q: ACK message

    Note over C,Cache: Cache Result Retrieval

    C->>API: POST /compile (with config)
    API->>Cache: Check for cached result
    Cache-->>API: Compressed result
    API->>API: Decompress
    API-->>C: 200 OK (rules, cached: true)
```

## Processing Architecture

```mermaid
flowchart TD
    START[Queue Message Received] --> VALIDATE{Validate<br/>Message Type}

    VALIDATE -->|compile| SINGLE[Single Compilation]
    VALIDATE -->|batch-compile| BATCH[Batch Compilation]
    VALIDATE -->|cache-warm| WARM[Cache Warming]
    VALIDATE -->|unknown| UNKNOWN[Unknown Type]

    SINGLE --> TRACE1[Create Tracing Context]
    TRACE1 --> COMP1[Run Compilation]
    COMP1 --> CACHE1{Cacheable?}
    CACHE1 -->|Yes| COMPRESS1[Compress Result]
    CACHE1 -->|No| ACK1[ACK Message]
    COMPRESS1 --> STORE1[Store in KV]
    STORE1 --> ACK1

    BATCH --> CHUNK[Split into Chunks<br/>Size: 3]
    CHUNK --> PARALLEL[Process Chunks in Parallel]
    PARALLEL --> COMP2[Compile Each Item]
    COMP2 --> STATS{All<br/>Successful?}
    STATS -->|Yes| ACK2[ACK Message]
    STATS -->|No| RETRY2[RETRY Message]

    WARM --> CHUNK2[Split into Chunks<br/>Size: 3]
    CHUNK2 --> PARALLEL2[Process Chunks in Parallel]
    PARALLEL2 --> COMP3[Compile + Cache Each]
    COMP3 --> STATS2{All<br/>Successful?}
    STATS2 -->|Yes| ACK3[ACK Message]
    STATS2 -->|No| RETRY3[RETRY Message]

    UNKNOWN --> ACK_UNK[ACK to prevent<br/>infinite retries]

    ACK1 --> END[Processing Complete]
    ACK2 --> END
    ACK3 --> END
    ACK_UNK --> END
    RETRY2 --> RETRY_QUEUE[Back to Queue]
    RETRY3 --> RETRY_QUEUE
    RETRY_QUEUE -.->|Exponential backoff| START

    style START fill:#e1f5e1
    style END fill:#e1f5e1
    style VALIDATE fill:#fff3cd
    style RETRY_QUEUE fill:#f8d7da
```

## Concurrency Control

```mermaid
graph LR
    subgraph "Queue Consumer (Sequential)"
        MSG1[Message 1] --> PROC1[Process]
        PROC1 --> ACK1[ACK]
        ACK1 --> MSG2[Message 2]
        MSG2 --> PROC2[Process]
        PROC2 --> ACK2[ACK]
    end

    subgraph "Batch Processing (Chunked)"
        BATCH[10 Items]
        BATCH --> CHUNK1[Chunk 1<br/>Items 1-3]
        BATCH --> CHUNK2[Chunk 2<br/>Items 4-6]
        BATCH --> CHUNK3[Chunk 3<br/>Items 7-9]
        BATCH --> CHUNK4[Chunk 4<br/>Item 10]

        CHUNK1 --> P1[Process in Parallel]
        CHUNK2 --> P2[Process in Parallel]
        CHUNK3 --> P3[Process in Parallel]
        CHUNK4 --> P4[Process Sequentially]
    end

    style PROC1 fill:#bbf
    style PROC2 fill:#bbf
    style P1 fill:#bfb
    style P2 fill:#bfb
    style P3 fill:#bfb
    style P4 fill:#bfb
```

## Error Handling and Retry Logic

```mermaid
stateDiagram-v2
    [*] --> Queued: Message sent

    Queued --> Processing: Consumer picks up
    Processing --> Success: Compilation OK
    Processing --> Error: Compilation fails

    Success --> Cached: Store in KV
    Cached --> Acknowledged: ACK message
    Acknowledged --> [*]

    Error --> RetryLogic: Evaluate error
    RetryLogic --> Retry1: Attempt 1
    Retry1 --> Processing
    Retry1 --> Retry2: Still failing
    Retry2 --> Processing
    Retry2 --> Retry3: Still failing
    Retry3 --> Processing
    Retry3 --> DeadLetter: Max retries

    DeadLetter --> [*]: Manual intervention

    note right of Processing
        Log all operations
        Track metrics
        Emit diagnostics
    end note

    note right of RetryLogic
        Exponential backoff
        Automatic by Cloudflare
    end note
```

## Data Flow and Caching Strategy

```mermaid
flowchart LR
    subgraph "Request Flow"
        REQ[Client Request] --> CHECK{Cache<br/>Exists?}
        CHECK -->|Yes| RETURN[Return Cached]
        CHECK -->|No| QUEUE_IT[Queue for Async]
    end

    subgraph "Queue Processing"
        QUEUE_IT --> PROCESS[Compile]
        PROCESS --> COMPRESS[Compress]
        COMPRESS --> STORE[Store in Cache]
    end

    subgraph "Cache Layer"
        STORE --> KV[KV Namespace]
        KV -->|TTL: 1 hour| EXPIRE[Auto Expire]
        KV -->|Hit| RETURN
    end

    subgraph "Metrics Layer"
        PROCESS --> METRICS[Record Metrics]
        METRICS --> WINDOW[5-min Windows]
        WINDOW --> AGGREGATE[Aggregate Stats]
    end

    style CHECK fill:#fff3cd
    style KV fill:#bfb
    style COMPRESS fill:#bbf
```

## Monitoring and Observability

```mermaid
graph TB
    subgraph "Logging Strategy"
        QUEUE_LOG[Queue Handler Logs]
        COMPILE_LOG[Compilation Logs]
        CACHE_LOG[Cache Operation Logs]
        ERROR_LOG[Error Logs]
    end

    subgraph "Log Prefixes"
        PREFIX1["[QUEUE:HANDLER]"]
        PREFIX2["[QUEUE:COMPILE]"]
        PREFIX3["[QUEUE:BATCH]"]
        PREFIX4["[QUEUE:CACHE-WARM]"]
        PREFIX5["[QUEUE:CHUNKS]"]
        PREFIX6["[API:ASYNC]"]
        PREFIX7["[API:BATCH-ASYNC]"]
    end

    subgraph "Metrics Tracked"
        M1[Processing Time]
        M2[Success/Failure Ratio]
        M3[Compression Ratio]
        M4[Queue Depth]
        M5[Cache Hit Rate]
        M6[Batch Size Stats]
    end

    subgraph "Diagnostics"
        D1[Source Download Events]
        D2[Transformation Events]
        D3[Validation Events]
        D4[Performance Events]
    end

    QUEUE_LOG --> PREFIX1
    COMPILE_LOG --> PREFIX2
    CACHE_LOG --> PREFIX6

    COMPILE_LOG --> M1
    COMPILE_LOG --> M2
    COMPILE_LOG --> M3

    D1 --> TAIL[Tail Worker]
    D2 --> TAIL
    D3 --> TAIL
    D4 --> TAIL

    M1 --> ANALYTICS[Analytics Engine]
    M2 --> ANALYTICS
    M5 --> ANALYTICS

    style TAIL fill:#f9f
    style ANALYTICS fill:#bbf
```

## Key Features

### 1. Asynchronous Processing
- Non-blocking API endpoints
- Immediate 202 Accepted response
- Background compilation via queue

### 2. Concurrency Control
- Sequential message processing to avoid overwhelming resources
- Chunked batch processing (max 3 parallel compilations per chunk)
- Configurable chunk size

### 3. Caching Strategy
- Gzip compression reduces storage by 70-80%
- 1-hour TTL for compiled results
- Cache key based on configuration hash
- No caching for pre-fetched content

### 4. Error Handling
- Automatic retry with exponential backoff
- Message acknowledgment on success
- Retry on failure
- Unknown message types acknowledged to prevent infinite loops

### 5. Monitoring and Diagnostics
- Structured console logging with prefixes
- Detailed metrics tracking
- Diagnostic events emitted to tail worker
- Performance timing at every stage

### 6. Scalability
- Queue handles unlimited backpressure
- No rate limiting on async endpoints
- Horizontal scaling via queue
- Batch processing for efficiency

## Configuration

### Queue Settings (wrangler.toml)
```toml
[[queues.producers]]
 queue = "adblock-compiler-worker-queue"
 binding = "ADBLOCK_COMPILER_QUEUE"

[[queues.consumers]]
 queue = "adblock-compiler-worker-queue"
 max_batch_size = 10
 max_batch_timeout = 5
 dead_letter_queue = "dead-letter-queue"
```

### Resource Limits
- **Batch Size**: Up to 100 requests per batch
- **Chunk Size**: 3 concurrent compilations
- **Message Timeout**: 5 seconds before batch delivery
- **Cache TTL**: 3600 seconds (1 hour)

### Performance Characteristics
- **Enqueue Time**: < 100ms
- **Processing Time**: 5-30 seconds per compilation (varies by filter list size)
- **Compression Ratio**: 70-80% reduction
- **Cache Hit Rate**: High for repeated configurations

## Usage Examples

### Single Async Compilation
```bash
curl -X POST https://worker.dev/compile/async \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "name": "My Filter",
      "sources": [{"source": "https://example.com/filters.txt"}]
    }
  }'
```

Response:
```json
{
  "success": true,
  "message": "Compilation job queued successfully",
  "requestId": "compile-1234567890-abc123"
}
```

### Batch Async Compilation
```bash
curl -X POST https://worker.dev/compile/batch/async \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "id": "filter-1",
        "configuration": {
          "name": "Filter 1",
          "sources": [{"source": "https://example.com/filter1.txt"}]
        }
      },
      {
        "id": "filter-2",
        "configuration": {
          "name": "Filter 2",
          "sources": [{"source": "https://example.com/filter2.txt"}]
        }
      }
    ]
  }'
```

Response:
```json
{
  "success": true,
  "message": "Batch of 2 compilation jobs queued successfully",
  "requestId": "batch-1234567890-def456",
  "batchSize": 2
}
```

## Troubleshooting

### Queue Not Processing
1. Check queue exists: `wrangler queues list`
2. Verify queue bindings in `wrangler.toml`
3. Check worker logs: `wrangler tail`

### Messages Failing
1. Check error logs for specific failure reasons
2. Verify source URLs are accessible
3. Check KV namespace bindings

### Performance Issues
1. Increase `max_batch_size` for higher throughput
2. Adjust chunk size for batch processing
3. Monitor queue depth and consumer lag

## Related Documentation

- [QUEUE_SUPPORT.md](./QUEUE_SUPPORT.md) - Detailed usage guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Implementation details
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
