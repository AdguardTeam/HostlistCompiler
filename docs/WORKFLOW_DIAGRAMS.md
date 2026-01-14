# Workflow Diagrams

This document contains comprehensive workflow diagrams for the adblock-compiler system, including queuing, compilation, and other key processes.

## Table of Contents
- [Queue System Workflows](#queue-system-workflows)
  - [Async Compilation Flow](#async-compilation-flow)
  - [Queue Message Processing](#queue-message-processing)
  - [Priority Queue Routing](#priority-queue-routing)
  - [Batch Processing Flow](#batch-processing-flow)
  - [Cache Warming Flow](#cache-warming-flow)
- [Compilation Workflows](#compilation-workflows)
  - [Filter Compilation Process](#filter-compilation-process)
  - [Source Compilation](#source-compilation)
  - [Request Deduplication](#request-deduplication)
- [Supporting Processes](#supporting-processes)
  - [Rate Limiting](#rate-limiting)
  - [Caching Strategy](#caching-strategy)
  - [Error Handling & Retry](#error-handling--retry)

---

## Queue System Workflows

### Async Compilation Flow

Complete end-to-end flow for asynchronous compilation requests.

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Worker API
    participant RL as Rate Limiter
    participant TS as Turnstile
    participant QP as Queue Producer
    participant Q as Cloudflare Queue
    participant QC as Queue Consumer
    participant Compiler as FilterCompiler
    participant KV as KV Cache
    participant Metrics as Metrics Store

    Note over C,Metrics: Async Compilation Request Flow

    C->>API: POST /compile/async
    API->>API: Extract IP & Config
    
    API->>RL: Check Rate Limit
    alt Rate Limit Exceeded
        RL-->>API: Denied
        API-->>C: 429 Too Many Requests
    else Rate Limit OK
        RL-->>API: Allowed
        
        API->>TS: Verify Turnstile Token
        alt Turnstile Failed
            TS-->>API: Invalid
            API-->>C: 403 Forbidden
        else Turnstile OK
            TS-->>API: Valid
            
            API->>API: Generate Request ID
            API->>API: Create Queue Message
            API->>QP: Route by Priority
            
            alt High Priority
                QP->>Q: Send to High Priority Queue
            else Standard Priority
                QP->>Q: Send to Standard Queue
            end
            
            API->>Metrics: Track Enqueued
            API-->>C: 202 Accepted (requestId, priority)
            
            Note over Q,QC: Asynchronous Processing

            Q->>Q: Batch Messages
            Q->>QC: Deliver Message Batch
            
            QC->>QC: Dispatch by Type
            QC->>Compiler: Execute Compilation
            Compiler->>Compiler: Validate Config
            Compiler->>Compiler: Fetch & Compile Sources
            Compiler->>Compiler: Apply Transformations
            Compiler-->>QC: Compiled Rules + Metrics
            
            QC->>QC: Compress Result (gzip)
            QC->>KV: Store Cached Result
            QC->>Metrics: Track Completion
            QC->>Q: ACK Message
            
            Note over C,KV: Result Retrieval (Later)
            
            C->>API: POST /compile (same config)
            API->>KV: Check Cache by Key
            KV-->>API: Cached Result
            API->>API: Decompress Result
            API-->>C: 200 OK (rules, cached: true)
        end
    end
```

### Queue Message Processing

Internal queue consumer flow showing message type dispatch and processing.

```mermaid
flowchart TD
    Start[Queue Consumer: handleQueue] --> BatchReceived{Message Batch Received}
    BatchReceived --> InitStats[Initialize Stats: acked=0, retried=0, unknown=0]
    
    InitStats --> LogBatch[Log: Processing batch of N messages]
    LogBatch --> ProcessLoop[For Each Message in Batch]
    
    ProcessLoop --> ExtractBody[Extract message.body]
    ExtractBody --> LogMessage[Log: Processing message X/N]
    
    LogMessage --> TypeCheck{Switch on message.type}
    
    TypeCheck -->|compile| ProcessCompile[processCompileMessage]
    TypeCheck -->|batch-compile| ProcessBatch[processBatchCompileMessage]
    TypeCheck -->|cache-warm| ProcessWarm[processCacheWarmMessage]
    TypeCheck -->|unknown| LogUnknown[Log: Unknown message type]
    
    ProcessCompile --> TryCompile{Compilation Success?}
    ProcessBatch --> TryBatch{Batch Success?}
    ProcessWarm --> TryWarm{Cache Warm Success?}
    LogUnknown --> AckUnknown[ACK message - unknown++]
    
    TryCompile -->|Success| AckCompile[ACK message - acked++]
    TryCompile -->|Error| RetryCompile[RETRY message - retried++]
    
    TryBatch -->|Success| AckBatch[ACK message - acked++]
    TryBatch -->|Error| RetryBatch[RETRY message - retried++]
    
    TryWarm -->|Success| AckWarm[ACK message - acked++]
    TryWarm -->|Error| RetryWarm[RETRY message - retried++]
    
    AckCompile --> LogComplete[Log: Message completed + duration]
    AckBatch --> LogComplete
    AckWarm --> LogComplete
    AckUnknown --> LogComplete
    RetryCompile --> LogError[Log: Message failed, will retry]
    RetryBatch --> LogError
    RetryWarm --> LogError
    
    LogComplete --> MoreMessages{More Messages?}
    LogError --> MoreMessages
    
    MoreMessages -->|Yes| ProcessLoop
    MoreMessages -->|No| LogBatchStats[Log: Batch statistics]
    
    LogBatchStats --> End[End Queue Processing]
    
    style ProcessCompile fill:#e1f5ff
    style ProcessBatch fill:#e1f5ff
    style ProcessWarm fill:#e1f5ff
    style AckCompile fill:#c8e6c9
    style AckBatch fill:#c8e6c9
    style AckWarm fill:#c8e6c9
    style AckUnknown fill:#fff9c4
    style RetryCompile fill:#ffcdd2
    style RetryBatch fill:#ffcdd2
    style RetryWarm fill:#ffcdd2
```

### Priority Queue Routing

Shows how messages are routed to different queues based on priority level.

```mermaid
flowchart LR
    Client[Client Request] --> API[API Endpoint]
    
    API --> Extract[Extract Priority Field]
    Extract --> DefaultCheck{Priority Specified?}
    
    DefaultCheck -->|No| SetDefault[Set priority = 'standard']
    DefaultCheck -->|Yes| Validate{Validate Priority}
    
    SetDefault --> Route
    Validate -->|Invalid| SetDefault
    Validate -->|Valid| Route[Route Message]
    
    Route --> PriorityCheck{priority === 'high'?}
    
    PriorityCheck -->|Yes| HighQueue[(High Priority Queue)]
    PriorityCheck -->|No| StandardQueue[(Standard Queue)]
    
    HighQueue --> HighConsumer[High Priority Consumer]
    StandardQueue --> StandardConsumer[Standard Consumer]
    
    HighConsumer --> HighConfig[Config: max_batch_size=5<br/>max_batch_timeout=2s]
    StandardConsumer --> StandardConfig[Config: max_batch_size=10<br/>max_batch_timeout=5s]
    
    HighConfig --> Process[Process Messages]
    StandardConfig --> Process
    
    Process --> Result[Compilation Complete]
    
    style HighQueue fill:#ff9800
    style StandardQueue fill:#4caf50
    style HighConsumer fill:#ffe0b2
    style StandardConsumer fill:#c8e6c9
    style Result fill:#e1f5ff
```

### Batch Processing Flow

Detailed flow showing how batch compilations are processed with chunking.

```mermaid
flowchart TD
    Start[processBatchCompileMessage] --> LogStart[Log: Starting batch of N requests]
    
    LogStart --> InitChunk[Initialize Chunk Processing<br/>chunkSize = 3]
    InitChunk --> SplitChunks[Split requests into chunks]
    
    SplitChunks --> ChunkLoop{For Each Chunk}
    
    ChunkLoop --> LogChunk[Log: Processing chunk X/Y]
    LogChunk --> CreatePromises[Create Promise Array<br/>for Chunk Items]
    
    CreatePromises --> ParallelExec[Promise.allSettled<br/>Execute 3 in Parallel]
    
    ParallelExec --> ProcessItem1[Create CompileQueueMessage<br/>processCompileMessage - Item 1]
    ParallelExec --> ProcessItem2[Create CompileQueueMessage<br/>processCompileMessage - Item 2]
    ParallelExec --> ProcessItem3[Create CompileQueueMessage<br/>processCompileMessage - Item 3]
    
    ProcessItem1 --> Compile1[Compile + Cache]
    ProcessItem2 --> Compile2[Compile + Cache]
    ProcessItem3 --> Compile3[Compile + Cache]
    
    Compile1 --> Settle1{Status}
    Compile2 --> Settle2{Status}
    Compile3 --> Settle3{Status}
    
    Settle1 -->|fulfilled| Success1[successful++]
    Settle1 -->|rejected| Fail1[failed++<br/>Record Error]
    
    Settle2 -->|fulfilled| Success2[successful++]
    Settle2 -->|rejected| Fail2[failed++<br/>Record Error]
    
    Settle3 -->|fulfilled| Success3[successful++]
    Settle3 -->|rejected| Fail3[failed++<br/>Record Error]
    
    Success1 --> ChunkComplete
    Fail1 --> ChunkComplete
    Success2 --> ChunkComplete
    Fail2 --> ChunkComplete
    Success3 --> ChunkComplete
    Fail3 --> ChunkComplete
    
    ChunkComplete[Log: Chunk complete<br/>X/Y successful] --> MoreChunks{More Chunks?}
    
    MoreChunks -->|Yes| ChunkLoop
    MoreChunks -->|No| CheckFailures{Any Failures?}
    
    CheckFailures -->|Yes| LogFailures[Log: Failed items details]
    CheckFailures -->|No| LogSuccess[Log: Batch complete<br/>All successful]
    
    LogFailures --> ThrowError[Throw Error:<br/>Batch partially failed]
    ThrowError --> RetryBatch[Message Will Retry]
    
    LogSuccess --> AckBatch[ACK Message<br/>Batch Complete]
    
    RetryBatch --> End[End]
    AckBatch --> End
    
    style ParallelExec fill:#bbdefb
    style Compile1 fill:#e1f5ff
    style Compile2 fill:#e1f5ff
    style Compile3 fill:#e1f5ff
    style Success1 fill:#c8e6c9
    style Success2 fill:#c8e6c9
    style Success3 fill:#c8e6c9
    style Fail1 fill:#ffcdd2
    style Fail2 fill:#ffcdd2
    style Fail3 fill:#ffcdd2
    style ThrowError fill:#f44336
    style AckBatch fill:#4caf50
```

### Cache Warming Flow

Process for pre-warming the cache with popular filter lists.

```mermaid
flowchart TD
    Start[processCacheWarmMessage] --> Extract[Extract configurations array]
    
    Extract --> LogStart[Log: Starting cache warming<br/>for N configurations]
    
    LogStart --> InitStats[Initialize:<br/>successful=0, failed=0, failures=[]]
    
    InitStats --> ChunkLoop[Process in Chunks of 3]
    
    ChunkLoop --> Chunk1{Chunk 1}
    Chunk1 --> Config1A[Configuration A]
    Chunk1 --> Config1B[Configuration B]
    Chunk1 --> Config1C[Configuration C]
    
    Config1A --> Compile1A[Create CompileQueueMessage<br/>Generate Request ID]
    Config1B --> Compile1B[Create CompileQueueMessage<br/>Generate Request ID]
    Config1C --> Compile1C[Create CompileQueueMessage<br/>Generate Request ID]
    
    Compile1A --> Process1A[processCompileMessage:<br/>Validate, Fetch, Compile]
    Compile1B --> Process1B[processCompileMessage:<br/>Validate, Fetch, Compile]
    Compile1C --> Process1C[processCompileMessage:<br/>Validate, Fetch, Compile]
    
    Process1A --> Cache1A[Cache Result in KV]
    Process1B --> Cache1B[Cache Result in KV]
    Process1C --> Cache1C[Cache Result in KV]
    
    Cache1A --> Result1A{Success?}
    Cache1B --> Result1B{Success?}
    Cache1C --> Result1C{Success?}
    
    Result1A -->|Yes| Inc1A[successful++]
    Result1A -->|No| Fail1A[failed++, Record Error]
    Result1B -->|Yes| Inc1B[successful++]
    Result1B -->|No| Fail1B[failed++, Record Error]
    Result1C -->|Yes| Inc1C[successful++]
    Result1C -->|No| Fail1C[failed++, Record Error]
    
    Inc1A --> ChunkDone
    Fail1A --> ChunkDone
    Inc1B --> ChunkDone
    Fail1B --> ChunkDone
    Inc1C --> ChunkDone
    Fail1C --> ChunkDone
    
    ChunkDone[Log: Chunk complete] --> MoreChunks{More Chunks?}
    
    MoreChunks -->|Yes| ChunkLoop
    MoreChunks -->|No| FinalCheck{Any Failures?}
    
    FinalCheck -->|Yes| LogErrors[Log: Failed configurations<br/>with details]
    FinalCheck -->|No| LogComplete[Log: Cache warming complete<br/>All successful]
    
    LogErrors --> ThrowError[Throw Error:<br/>Partially Failed]
    LogComplete --> Success[Cache Ready for<br/>Future Requests]
    
    ThrowError --> Retry[Message Retried]
    Success --> End[End]
    Retry --> End
    
    style Process1A fill:#e1f5ff
    style Process1B fill:#e1f5ff
    style Process1C fill:#e1f5ff
    style Cache1A fill:#fff9c4
    style Cache1B fill:#fff9c4
    style Cache1C fill:#fff9c4
    style Inc1A fill:#c8e6c9
    style Inc1B fill:#c8e6c9
    style Inc1C fill:#c8e6c9
    style Fail1A fill:#ffcdd2
    style Fail1B fill:#ffcdd2
    style Fail1C fill:#ffcdd2
    style Success fill:#4caf50
```

---

## Compilation Workflows

### Filter Compilation Process

Core compilation flow from configuration to final rules.

```mermaid
flowchart TD
    Start[FilterCompiler.compileWithMetrics] --> InitBenchmark{Benchmark Enabled?}
    
    InitBenchmark -->|Yes| CreateCollector[Create BenchmarkCollector]
    InitBenchmark -->|No| NoBenchmark[collector = null]
    
    CreateCollector --> StartTrace
    NoBenchmark --> StartTrace[Start Tracing: compileFilterList]
    
    StartTrace --> ValidateConfig[Validate Configuration]
    ValidateConfig --> ValidationCheck{Valid?}
    
    ValidationCheck -->|No| LogValidationError[Emit operationError<br/>Log Error]
    ValidationCheck -->|Yes| TraceValidation[Emit operationComplete<br/>valid: true]
    
    LogValidationError --> ThrowError[Throw ConfigurationError]
    
    TraceValidation --> LogConfig[Log Configuration JSON]
    LogConfig --> ExtractSources[Extract configuration.sources]
    
    ExtractSources --> StartSourceTrace[Start Tracing: compileSources]
    StartSourceTrace --> ParallelSources[Promise.all: Compile Sources in Parallel]
    
    ParallelSources --> Source1[SourceCompiler.compile<br/>Source 0 of N]
    ParallelSources --> Source2[SourceCompiler.compile<br/>Source 1 of N]
    ParallelSources --> Source3[SourceCompiler.compile<br/>Source N-1 of N]
    
    Source1 --> Rules1[rules: string[]]
    Source2 --> Rules2[rules: string[]]
    Source3 --> Rules3[rules: string[]]
    
    Rules1 --> CompleteTrace
    Rules2 --> CompleteTrace
    Rules3 --> CompleteTrace[Emit operationComplete<br/>totalRules count]
    
    CompleteTrace --> CombineResults[Combine Source Results<br/>Maintain Order]
    
    CombineResults --> AddHeaders[Add Source Headers]
    AddHeaders --> ApplyTransforms[Apply Transformations]
    
    ApplyTransforms --> Transform1[Transformation 1]
    Transform1 --> Transform2[Transformation 2]
    Transform2 --> TransformN[Transformation N]
    
    TransformN --> CompleteCompilation[Emit operationComplete:<br/>compileFilterList]
    
    CompleteCompilation --> GenerateHeader[Generate List Header]
    GenerateHeader --> AddChecksum[Add Checksum to Header]
    
    AddChecksum --> FinalRules[Combine: Header + Rules]
    FinalRules --> CollectMetrics{Benchmark?}
    
    CollectMetrics -->|Yes| StopCollector[collector.stop<br/>Gather Metrics]
    CollectMetrics -->|No| NoMetrics[metrics = undefined]
    
    StopCollector --> ReturnResult
    NoMetrics --> ReturnResult[Return: CompilationResult<br/>rules, metrics, diagnostics]
    
    ReturnResult --> End[End]
    ThrowError --> End
    
    style ParallelSources fill:#bbdefb
    style Source1 fill:#e1f5ff
    style Source2 fill:#e1f5ff
    style Source3 fill:#e1f5ff
    style ApplyTransforms fill:#fff9c4
    style ReturnResult fill:#c8e6c9
    style ThrowError fill:#ffcdd2
```

### Source Compilation

Individual source processing within the compiler.

```mermaid
sequenceDiagram
    participant FC as FilterCompiler
    participant SC as SourceCompiler
    participant FD as FilterDownloader
    participant Pipeline as TransformationPipeline
    participant Trace as TracingContext
    participant Events as EventEmitter

    FC->>SC: compile(source, index, totalSources)
    SC->>Trace: operationStart('compileSource')
    SC->>Events: onProgress('Downloading...')
    
    SC->>FD: download(source.source)
    FD->>FD: Fetch URL / Use Pre-fetched
    
    alt Download Failed
        FD-->>SC: throw DownloadError
        SC->>Trace: operationError(error)
        SC->>Events: onSourceError(error)
        SC-->>FC: throw error
    else Download Success
        FD-->>SC: rules: string[]
        SC->>Trace: operationComplete(download)
        SC->>Events: onSourceComplete
        
        SC->>Events: onProgress('Applying transformations...')
        SC->>Pipeline: applyAll(rules, source.transformations)
        
        loop For Each Transformation
            Pipeline->>Pipeline: Apply Transformation
            Pipeline->>Events: onTransformationApplied
        end
        
        Pipeline-->>SC: transformed rules
        SC->>Trace: operationComplete('compileSource')
        SC-->>FC: rules: string[]
    end
```

### Request Deduplication

In-flight request deduplication using cache keys.

```mermaid
flowchart TD
    Start[Incoming Request] --> ExtractConfig[Extract Configuration]
    
    ExtractConfig --> HasPreFetch{Has Pre-fetched<br/>Content?}
    
    HasPreFetch -->|Yes| BypassDedup[Skip Deduplication<br/>No Cache Key]
    HasPreFetch -->|No| GenerateKey[Generate Cache Key<br/>getCacheKey]
    
    GenerateKey --> NormalizeConfig[Normalize Config:<br/>Sort Keys, JSON.stringify]
    NormalizeConfig --> HashConfig[Hash String<br/>hashString]
    HashConfig --> CreateKey[cache:HASH]
    
    CreateKey --> CheckPending{Pending Request<br/>Exists?}
    
    CheckPending -->|Yes| WaitPending[Wait for Existing<br/>Promise to Resolve]
    CheckPending -->|No| CheckCache{Check KV Cache}
    
    WaitPending --> GetResult[Get Shared Result]
    GetResult --> ReturnCached[Return Cached Result]
    
    CheckCache -->|Hit| DecompressCache[Decompress gzip]
    CheckCache -->|Miss| AddPending[Add to pendingCompilations Map]
    
    DecompressCache --> ReturnCached
    
    AddPending --> StartCompile[Start New Compilation]
    StartCompile --> DoCompile[Execute Compilation]
    DoCompile --> Compress[Compress Result - gzip]
    Compress --> StoreCache[Store in KV Cache<br/>TTL: CACHE_TTL]
    StoreCache --> RemovePending[Remove from pendingCompilations]
    RemovePending --> ReturnResult[Return Fresh Result]
    
    BypassDedup --> DoCompile
    ReturnResult --> End[End]
    ReturnCached --> End
    
    style CheckPending fill:#fff9c4
    style WaitPending fill:#ffe0b2
    style AddPending fill:#e1f5ff
    style ReturnCached fill:#c8e6c9
    style ReturnResult fill:#c8e6c9
```

---

## Supporting Processes

### Rate Limiting

Rate limiting check for incoming requests.

```mermaid
flowchart TD
    Start[checkRateLimit] --> ExtractIP[Extract Client IP]
    
    ExtractIP --> CreateKey[Create Key:<br/>ratelimit:IP]
    CreateKey --> GetCurrent[Get Current Count from KV]
    
    GetCurrent --> CheckData{Data Exists?}
    
    CheckData -->|No| FirstRequest[First Request or Expired]
    CheckData -->|Yes| CheckExpired{now > resetAt?}
    
    CheckExpired -->|Yes| WindowExpired[Window Expired]
    CheckExpired -->|No| CheckLimit{count >= MAX_REQUESTS?}
    
    FirstRequest --> StartWindow[Create New Window:<br/>count=1, resetAt=now+WINDOW]
    WindowExpired --> StartWindow
    
    StartWindow --> StoreNew[Store in KV<br/>TTL: WINDOW + 10s]
    StoreNew --> AllowRequest[Return: true - Allow]
    
    CheckLimit -->|Yes| DenyRequest[Return: false - Deny]
    CheckLimit -->|No| IncrementCount[Increment count++]
    
    IncrementCount --> UpdateKV[Update KV:<br/>Same resetAt, New count]
    UpdateKV --> AllowRequest
    
    AllowRequest --> End[End]
    DenyRequest --> End
    
    style AllowRequest fill:#c8e6c9
    style DenyRequest fill:#ffcdd2
    style StartWindow fill:#e1f5ff
```

### Caching Strategy

Comprehensive caching flow with compression.

```mermaid
flowchart LR
    subgraph "Write Path"
        CompileComplete[Compilation Complete] --> CreateResult[Create CompilationResult:<br/>success, rules, ruleCount, metrics, compiledAt]
        CreateResult --> MeasureSize[Measure Uncompressed Size]
        MeasureSize --> Compress[Compress with gzip]
        Compress --> MeasureCompressed[Measure Compressed Size]
        MeasureCompressed --> CalcRatio[Calculate Compression Ratio:<br/>70-80% typical]
        CalcRatio --> StoreKV[Store in KV:<br/>Key: cache:HASH<br/>TTL: 3600s]
        StoreKV --> LogCache[Log: Cache stored<br/>Size & Compression]
    end
    
    subgraph "Read Path"
        Request[Incoming Request] --> GenerateKey[Generate Cache Key]
        GenerateKey --> LookupKV[Lookup in KV]
        LookupKV --> Found{Found?}
        Found -->|No| CacheMiss[Cache Miss]
        Found -->|Yes| ReadCompressed[Read Compressed Data]
        ReadCompressed --> Decompress[Decompress gzip]
        Decompress --> ParseJSON[Parse JSON]
        ParseJSON --> ReturnCached[Return Result<br/>cached: true]
        CacheMiss --> CompileNew[Start New Compilation]
    end
    
    LogCache -.->|Later Request| Request
    
    style Compress fill:#fff9c4
    style StoreKV fill:#e1f5ff
    style ReturnCached fill:#c8e6c9
    style CacheMiss fill:#ffcdd2
```

### Error Handling & Retry

Queue message retry strategy with exponential backoff.

```mermaid
stateDiagram-v2
    [*] --> Enqueued: Message Sent to Queue
    
    Enqueued --> Batched: Queue Batching
    Batched --> Processing: Consumer Receives
    
    Processing --> Validating: Extract & Validate
    
    Validating --> Compiling: Valid Message
    Validating --> UnknownType: Unknown Type
    
    UnknownType --> Acknowledged: ACK (Prevent Loop)
    Acknowledged --> [*]
    
    Compiling --> CachingResult: Compilation Success
    Compiling --> Error: Compilation Failed
    
    CachingResult --> Acknowledged: ACK Success
    
    Error --> Retry1: 1st Retry (Backoff: 2s)
    Retry1 --> Compiling
    
    Retry1 --> Retry2: Still Failed
    Retry2 --> Compiling: 2nd Retry (Backoff: 4s)
    
    Retry2 --> Retry3: Still Failed
    Retry3 --> Compiling: 3rd Retry (Backoff: 8s)
    
    Retry3 --> RetryN: Still Failed
    RetryN --> Compiling: Nth Retry (Backoff: 2^n s)
    
    RetryN --> DeadLetterQueue: Max Retries Exceeded
    DeadLetterQueue --> [*]: Manual Investigation
    
    note right of Error
        Retries triggered by:
        - Network failures
        - Source download errors
        - Compilation errors
        - KV storage errors
    end note
    
    note right of Acknowledged
        Success metrics tracked:
        - Request ID
        - Config name
        - Rule count
        - Duration
        - Cache key
    end note
```

---

## Queue Statistics & Monitoring

Queue statistics tracking for observability.

```mermaid
flowchart TD
    subgraph "Statistics Tracked"
        Enqueued[Enqueued Count]
        Completed[Completed Count]
        Failed[Failed Count]
        Processing[Processing Count]
    end
    
    subgraph "Per Job Metadata"
        RequestID[Request ID]
        ConfigName[Config Name]
        RuleCount[Rule Count]
        Duration[Duration ms]
        CacheKey[Cache Key]
        Error[Error Message]
    end
    
    subgraph "Storage"
        MetricsKV[(Metrics KV Store)]
        Logs[Console Logs]
        TailWorker[Tail Worker Events]
    end
    
    Enqueued --> MetricsKV
    Completed --> MetricsKV
    Failed --> MetricsKV
    Processing --> MetricsKV
    
    RequestID --> Logs
    ConfigName --> Logs
    RuleCount --> Logs
    Duration --> Logs
    CacheKey --> Logs
    Error --> Logs
    
    Logs --> TailWorker
    MetricsKV --> Dashboard[Cloudflare Dashboard]
    TailWorker --> ExternalMonitoring[External Monitoring<br/>Datadog, Splunk, etc.]
    
    style MetricsKV fill:#e1f5ff
    style Logs fill:#fff9c4
    style TailWorker fill:#ffe0b2
```

---

## Message Type Reference

Quick reference for the three queue message types:

| Message Type | Purpose | Processing | Chunking |
|--------------|---------|------------|----------|
| **compile** | Single compilation job | Direct compilation → cache | N/A |
| **batch-compile** | Multiple compilations | Parallel chunks of 3 | Yes (3 items) |
| **cache-warm** | Pre-compile popular lists | Parallel chunks of 3 | Yes (3 items) |

## Priority Level Comparison

| Priority | Queue | max_batch_size | max_batch_timeout | Use Case |
|----------|-------|----------------|-------------------|----------|
| **standard** | `adblock-compiler-worker-queue` | 10 | 5s | Batch operations, scheduled jobs |
| **high** | `adblock-compiler-worker-queue-high-priority` | 5 | 2s | Premium users, urgent requests |

---

## Notes

- All queue processing is asynchronous and non-blocking
- Parallel processing is limited to chunks of 3 to prevent resource exhaustion
- Cache TTL is 1 hour (3600s) by default
- Compression typically achieves 70-80% size reduction
- Rate limiting window is 60 seconds with max 10 requests per IP
- All operations include comprehensive logging with structured prefixes
- Diagnostic events are emitted to tail worker for centralized monitoring
- Error recovery uses exponential backoff with automatic retry
- Unknown message types are acknowledged to prevent infinite retry loops
