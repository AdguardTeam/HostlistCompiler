# Workflow Diagrams

This document contains comprehensive workflow diagrams for the adblock-compiler system, including Cloudflare Workflows, queue-based processing, compilation pipelines, and supporting processes.

## Table of Contents

- [System Architecture Overview](#system-architecture-overview)
- [Cloudflare Workflows](#cloudflare-workflows)
  - [Workflow System Architecture](#workflow-system-architecture)
  - [CompilationWorkflow](#compilationworkflow)
  - [BatchCompilationWorkflow](#batchcompilationworkflow)
  - [CacheWarmingWorkflow](#cachewarmingworkflow)
  - [HealthMonitoringWorkflow](#healthmonitoringworkflow)
  - [Workflow Events & Progress Tracking](#workflow-events--progress-tracking)
- [Queue System Workflows](#queue-system-workflows)
  - [Async Compilation Flow](#async-compilation-flow)
  - [Queue Message Processing](#queue-message-processing)
  - [Priority Queue Routing](#priority-queue-routing)
  - [Batch Processing Flow](#batch-processing-flow)
  - [Cache Warming Flow](#cache-warming-flow)
- [Compilation Workflows](#compilation-workflows)
  - [Filter Compilation Process](#filter-compilation-process)
  - [Source Compilation](#source-compilation)
  - [Transformation Pipeline](#transformation-pipeline)
  - [Request Deduplication](#request-deduplication)
- [Supporting Processes](#supporting-processes)
  - [Rate Limiting](#rate-limiting)
  - [Caching Strategy](#caching-strategy)
  - [Error Handling & Retry](#error-handling--retry)

---

## System Architecture Overview

High-level view of all processing systems and their interactions.

```mermaid
flowchart TB
    subgraph "Client Layer"
        WEB[Web UI]
        API_CLIENT[API Clients]
        CRON[Cron Scheduler]
    end

    subgraph "API Layer"
        direction TB
        SYNC[Synchronous Endpoints<br/>/compile, /compile/batch]
        ASYNC[Async Endpoints<br/>/compile/async, /compile/batch/async]
        WORKFLOW_API[Workflow Endpoints<br/>/workflow/*]
        STREAM[Streaming Endpoint<br/>/compile/stream]
    end

    subgraph "Processing Layer"
        direction TB

        subgraph "Cloudflare Workflows"
            CW[CompilationWorkflow]
            BCW[BatchCompilationWorkflow]
            CWW[CacheWarmingWorkflow]
            HMW[HealthMonitoringWorkflow]
        end

        subgraph "Cloudflare Queues"
            STD_Q[(Standard Queue)]
            HIGH_Q[(High Priority Queue)]
            DLQ[(Dead Letter Queue)]
        end

        CONSUMER[Queue Consumer]
    end

    subgraph "Compilation Engine"
        FC[FilterCompiler]
        SC[SourceCompiler]
        TP[TransformationPipeline]
        HG[HeaderGenerator]
    end

    subgraph "Storage Layer"
        KV_CACHE[(KV: COMPILATION_CACHE)]
        KV_METRICS[(KV: METRICS)]
        KV_RATE[(KV: RATE_LIMIT)]
        KV_EVENTS[(KV: Workflow Events)]
        D1[(D1: Analytics)]
    end

    subgraph "External Sources"
        EASYLIST[EasyList]
        ADGUARD[AdGuard]
        OTHER[Other Filter Sources]
    end

    %% Client connections
    WEB --> SYNC
    WEB --> STREAM
    API_CLIENT --> SYNC
    API_CLIENT --> ASYNC
    API_CLIENT --> WORKFLOW_API
    CRON --> CWW
    CRON --> HMW

    %% API to Processing
    SYNC --> FC
    ASYNC --> STD_Q
    ASYNC --> HIGH_Q
    WORKFLOW_API --> CW
    WORKFLOW_API --> BCW
    WORKFLOW_API --> CWW
    WORKFLOW_API --> HMW

    %% Queue processing
    STD_Q --> CONSUMER
    HIGH_Q --> CONSUMER
    CONSUMER --> FC
    CONSUMER -.-> DLQ

    %% Workflow processing
    CW --> FC
    BCW --> FC
    CWW --> FC
    HMW --> EASYLIST
    HMW --> ADGUARD
    HMW --> OTHER

    %% Compilation flow
    FC --> SC
    SC --> TP
    TP --> HG

    %% External sources
    SC --> EASYLIST
    SC --> ADGUARD
    SC --> OTHER

    %% Storage
    FC --> KV_CACHE
    CW --> KV_EVENTS
    BCW --> KV_EVENTS
    CONSUMER --> KV_METRICS
    CW --> KV_METRICS
    BCW --> KV_METRICS
    HMW --> D1

    style CW fill:#e1f5ff,stroke:#0288d1
    style BCW fill:#e1f5ff,stroke:#0288d1
    style CWW fill:#e1f5ff,stroke:#0288d1
    style HMW fill:#e1f5ff,stroke:#0288d1
    style STD_Q fill:#c8e6c9,stroke:#388e3c
    style HIGH_Q fill:#fff9c4,stroke:#fbc02d
    style DLQ fill:#ffcdd2,stroke:#d32f2f
    style KV_CACHE fill:#e1bee7,stroke:#7b1fa2
```

### Processing Path Comparison

| Path | Entry Point | Persistence | Crash Recovery | Best For |
|------|-------------|-------------|----------------|----------|
| **Synchronous** | `/compile` | None | N/A | Interactive requests |
| **Queue-Based** | `/compile/async` | Queue | Message retry | Batch operations |
| **Workflows** | `/workflow/*` | Per-step | Resume from checkpoint | Long-running, critical |
| **Streaming** | `/compile/stream` | None | N/A | Real-time progress |

---

## Cloudflare Workflows

Cloudflare Workflows provide durable execution with automatic state persistence, crash recovery, and observable progress.

### Workflow System Architecture

```mermaid
flowchart TB
    subgraph "Workflow Triggers"
        API_TRIGGER[API Request<br/>POST /workflow/*]
        CRON_TRIGGER[Cron Schedule<br/>0 */6 * * *]
        MANUAL[Manual Trigger]
    end

    subgraph "Workflow Engine"
        WF_RUNTIME[Cloudflare<br/>Workflow Runtime]

        subgraph "State Management"
            CHECKPOINT[Step Checkpoints]
            STATE_PERSIST[State Persistence]
            CRASH_DETECT[Crash Detection]
        end
    end

    subgraph "Available Workflows"
        direction LR
        COMP_WF[CompilationWorkflow<br/>Single compilation]
        BATCH_WF[BatchCompilationWorkflow<br/>Multiple compilations]
        CACHE_WF[CacheWarmingWorkflow<br/>Pre-populate cache]
        HEALTH_WF[HealthMonitoringWorkflow<br/>Source availability]
    end

    subgraph "Event System"
        EVENT_EMIT[Event Emitter]
        KV_EVENTS[(KV: workflow:events:*)]
        EVENT_API[GET /workflow/events/:id]
    end

    subgraph "Metrics & Analytics"
        AE[Analytics Engine]
        KV_METRICS[(KV: workflow:metrics)]
        METRICS_API[GET /workflow/metrics]
    end

    API_TRIGGER --> WF_RUNTIME
    CRON_TRIGGER --> WF_RUNTIME
    MANUAL --> WF_RUNTIME

    WF_RUNTIME --> COMP_WF
    WF_RUNTIME --> BATCH_WF
    WF_RUNTIME --> CACHE_WF
    WF_RUNTIME --> HEALTH_WF

    WF_RUNTIME --> CHECKPOINT
    CHECKPOINT --> STATE_PERSIST
    CRASH_DETECT --> CHECKPOINT

    COMP_WF --> EVENT_EMIT
    BATCH_WF --> EVENT_EMIT
    CACHE_WF --> EVENT_EMIT
    HEALTH_WF --> EVENT_EMIT

    EVENT_EMIT --> KV_EVENTS
    KV_EVENTS --> EVENT_API

    COMP_WF --> AE
    BATCH_WF --> AE
    CACHE_WF --> AE
    HEALTH_WF --> AE
    AE --> KV_METRICS
    KV_METRICS --> METRICS_API

    style COMP_WF fill:#e3f2fd,stroke:#1976d2
    style BATCH_WF fill:#e8f5e9,stroke:#388e3c
    style CACHE_WF fill:#fff8e1,stroke:#f57c00
    style HEALTH_WF fill:#fce4ec,stroke:#c2185b
```

### CompilationWorkflow

Handles single asynchronous compilation requests with durable state between steps.

```mermaid
flowchart TD
    subgraph "Step 1: validate"
        START([Workflow Start]) --> V_START[Start Validation]
        V_START --> V_EMIT1[Emit: workflow:started]
        V_EMIT1 --> V_CHECK{Configuration Valid?}
        V_CHECK -->|Yes| V_EMIT2[Emit: workflow:step:completed<br/>Progress: 10%]
        V_CHECK -->|No| V_ERROR[Emit: workflow:failed]
        V_ERROR --> RETURN_ERROR[Return Error Result]
    end

    subgraph "Step 2: compile-sources"
        V_EMIT2 --> C_START[Start Compilation]
        C_START --> C_EMIT1[Emit: workflow:step:started<br/>step: compile-sources]

        C_EMIT1 --> C_FETCH[Fetch Sources in Parallel]
        C_FETCH --> S1[Source 1]
        C_FETCH --> S2[Source 2]
        C_FETCH --> SN[Source N]

        S1 --> S1_EMIT[Emit: source:fetch:completed]
        S2 --> S2_EMIT[Emit: source:fetch:completed]
        SN --> SN_EMIT[Emit: source:fetch:completed]

        S1_EMIT --> C_COMBINE
        S2_EMIT --> C_COMBINE
        SN_EMIT --> C_COMBINE[Combine Rules]

        C_COMBINE --> C_TRANSFORM[Apply Transformations]
        C_TRANSFORM --> T_LOOP{For Each Transformation}
        T_LOOP --> T_APPLY[Apply Transformation]
        T_APPLY --> T_EMIT[Emit: transformation:completed]
        T_EMIT --> T_LOOP
        T_LOOP -->|Done| C_HEADER[Generate Header]

        C_HEADER --> C_EMIT2[Emit: workflow:step:completed<br/>Progress: 70%]
    end

    subgraph "Step 3: cache-result"
        C_EMIT2 --> CACHE_START[Start Caching]
        CACHE_START --> CACHE_COMPRESS[Gzip Compress Result]
        CACHE_COMPRESS --> CACHE_STORE[Store in KV<br/>TTL: 24 hours]
        CACHE_STORE --> CACHE_EMIT[Emit: cache:stored<br/>Progress: 90%]
    end

    subgraph "Step 4: update-metrics"
        CACHE_EMIT --> M_START[Update Metrics]
        M_START --> M_TRACK[Track in Analytics Engine]
        M_TRACK --> M_STORE[Store Metrics in KV]
        M_STORE --> M_EMIT[Emit: workflow:completed<br/>Progress: 100%]
    end

    M_EMIT --> RETURN_SUCCESS[Return Success Result]
    RETURN_ERROR --> END([Workflow End])
    RETURN_SUCCESS --> END

    style V_START fill:#e3f2fd
    style C_START fill:#fff8e1
    style CACHE_START fill:#e8f5e9
    style M_START fill:#f3e5f5
    style RETURN_SUCCESS fill:#c8e6c9
    style RETURN_ERROR fill:#ffcdd2
```

**Retry Configuration:**

| Step | Retries | Delay | Backoff | Timeout |
|------|---------|-------|---------|---------|
| validate | 1 | 1s | linear | 30s |
| compile-sources | 3 | 30s | exponential | 5m |
| cache-result | 2 | 2s | linear | 30s |
| update-metrics | 1 | 1s | linear | 10s |

### BatchCompilationWorkflow

Processes multiple compilations with per-chunk durability and crash recovery.

```mermaid
flowchart TD
    subgraph "Initialization"
        START([Batch Workflow Start]) --> INIT[Extract Batch Parameters]
        INIT --> EMIT_START[Emit: workflow:started<br/>batchSize, requestCount]
    end

    subgraph "Step 1: validate-batch"
        EMIT_START --> VAL_START[Validate All Configurations]
        VAL_START --> VAL_LOOP{For Each Request}
        VAL_LOOP --> VAL_CHECK{Config Valid?}
        VAL_CHECK -->|Yes| VAL_NEXT[Add to Valid List]
        VAL_CHECK -->|No| VAL_REJECT[Add to Rejected List]
        VAL_NEXT --> VAL_LOOP
        VAL_REJECT --> VAL_LOOP
        VAL_LOOP -->|Done| VAL_RESULT{Any Valid?}
        VAL_RESULT -->|No| BATCH_ERROR[Return: All Failed]
        VAL_RESULT -->|Yes| VAL_EMIT[Emit: workflow:step:completed<br/>validCount, rejectedCount]
    end

    subgraph "Step 2-N: compile-chunk-N"
        VAL_EMIT --> CHUNK_INIT[Split into Chunks<br/>MAX_CONCURRENT = 3]

        CHUNK_INIT --> CHUNK1[Chunk 1]

        subgraph "Chunk Processing"
            CHUNK1 --> C1_START[Step: compile-chunk-1]
            C1_START --> C1_EMIT[Emit: workflow:step:started]

            C1_EMIT --> C1_P1[Compile Item 1]
            C1_EMIT --> C1_P2[Compile Item 2]
            C1_EMIT --> C1_P3[Compile Item 3]

            C1_P1 --> C1_R1{Result}
            C1_P2 --> C1_R2{Result}
            C1_P3 --> C1_R3{Result}

            C1_R1 -->|Success| C1_S1[Cache Result 1]
            C1_R1 -->|Failure| C1_F1[Record Error 1]
            C1_R2 -->|Success| C1_S2[Cache Result 2]
            C1_R2 -->|Failure| C1_F2[Record Error 2]
            C1_R3 -->|Success| C1_S3[Cache Result 3]
            C1_R3 -->|Failure| C1_F3[Record Error 3]

            C1_S1 --> C1_SETTLE
            C1_F1 --> C1_SETTLE
            C1_S2 --> C1_SETTLE
            C1_F2 --> C1_SETTLE
            C1_S3 --> C1_SETTLE
            C1_F3 --> C1_SETTLE[Promise.allSettled]
        end

        C1_SETTLE --> C1_DONE[Emit: workflow:step:completed<br/>chunkSuccess, chunkFailed]
        C1_DONE --> CHUNK2{More Chunks?}
        CHUNK2 -->|Yes| NEXT_CHUNK[Process Next Chunk]
        NEXT_CHUNK --> C1_START
        CHUNK2 -->|No| METRICS_STEP
    end

    subgraph "Final Step: update-batch-metrics"
        METRICS_STEP[Step: update-batch-metrics] --> AGG[Aggregate Results]
        AGG --> TRACK[Track in Analytics]
        TRACK --> FINAL_EMIT[Emit: workflow:completed]
    end

    FINAL_EMIT --> RETURN[Return Batch Result]
    BATCH_ERROR --> END([Workflow End])
    RETURN --> END

    style CHUNK1 fill:#e3f2fd
    style C1_P1 fill:#fff8e1
    style C1_P2 fill:#fff8e1
    style C1_P3 fill:#fff8e1
    style C1_S1 fill:#c8e6c9
    style C1_S2 fill:#c8e6c9
    style C1_S3 fill:#c8e6c9
    style C1_F1 fill:#ffcdd2
    style C1_F2 fill:#ffcdd2
    style C1_F3 fill:#ffcdd2
```

**Crash Recovery Scenario:**

```mermaid
sequenceDiagram
    participant WF as BatchWorkflow
    participant CF as Cloudflare Runtime
    participant KV as State Storage

    Note over WF,KV: Normal Execution
    WF->>CF: Start chunk-1
    CF->>KV: Checkpoint: chunk-1 started
    WF->>WF: Process items 1-3
    CF->>KV: Checkpoint: chunk-1 complete

    WF->>CF: Start chunk-2
    CF->>KV: Checkpoint: chunk-2 started

    Note over WF,KV: Crash During chunk-2!
    WF--xWF: Worker crash/timeout

    Note over WF,KV: Automatic Recovery
    CF->>KV: Detect incomplete workflow
    CF->>KV: Load last checkpoint
    KV-->>CF: chunk-2 started (items 4-6)
    CF->>WF: Resume from chunk-2

    WF->>WF: Re-process items 4-6
    CF->>KV: Checkpoint: chunk-2 complete
    WF->>CF: Complete workflow
```

### CacheWarmingWorkflow

Pre-compiles and caches popular filter lists to reduce latency for end users.

```mermaid
flowchart TD
    subgraph "Trigger Sources"
        CRON[Cron: 0 */6 * * *<br/>Every 6 hours]
        MANUAL[Manual: POST /workflow/cache-warm]
    end

    subgraph "Initialization"
        CRON --> START
        MANUAL --> START([CacheWarmingWorkflow])
        START --> PARAMS{Custom Configs<br/>Provided?}
        PARAMS -->|Yes| USE_CUSTOM[Use Custom Configurations]
        PARAMS -->|No| USE_DEFAULT[Use Default Popular Lists]
    end

    subgraph "Default Configurations"
        USE_DEFAULT --> DEFAULT[Default Popular Lists]
        DEFAULT --> D1[EasyList<br/>https://easylist.to/.../easylist.txt]
        DEFAULT --> D2[EasyPrivacy<br/>https://easylist.to/.../easyprivacy.txt]
        DEFAULT --> D3[AdGuard Base<br/>https://filters.adtidy.org/.../filter.txt]
    end

    subgraph "Step 1: check-cache-status"
        USE_CUSTOM --> CHECK
        D1 --> CHECK
        D2 --> CHECK
        D3 --> CHECK
        CHECK[Check Existing Cache Status] --> CHECK_LOOP{For Each Config}
        CHECK_LOOP --> CACHE_CHECK{Cache Fresh?}
        CACHE_CHECK -->|Yes| SKIP[Skip - Already Cached]
        CACHE_CHECK -->|No/Expired| QUEUE[Add to Warming Queue]
        SKIP --> CHECK_LOOP
        QUEUE --> CHECK_LOOP
        CHECK_LOOP -->|Done| CHECK_EMIT[Emit: step:completed<br/>toWarm: N, skipped: M]
    end

    subgraph "Step 2-N: warm-chunk-N"
        CHECK_EMIT --> CHUNK_SPLIT[Split into Chunks<br/>MAX_CONCURRENT = 2]

        CHUNK_SPLIT --> CHUNK1[Chunk 1]
        CHUNK1 --> WARM1[Step: warm-chunk-1]

        WARM1 --> W1_C1[Compile Config 1]
        W1_C1 --> W1_WAIT1[Wait 2s<br/>Be Nice to Upstream]
        W1_WAIT1 --> W1_C2[Compile Config 2]
        W1_C2 --> W1_CACHE[Cache Both Results]
        W1_CACHE --> W1_EMIT[Emit: step:completed]

        W1_EMIT --> CHUNK_WAIT[Wait 10s<br/>Inter-chunk Delay]
        CHUNK_WAIT --> MORE_CHUNKS{More Chunks?}
        MORE_CHUNKS -->|Yes| NEXT_CHUNK[Process Next Chunk]
        NEXT_CHUNK --> WARM1
        MORE_CHUNKS -->|No| METRICS_STEP
    end

    subgraph "Step N+1: update-warming-metrics"
        METRICS_STEP[Update Warming Metrics] --> TRACK[Track Statistics]
        TRACK --> STORE[Store in KV/Analytics]
        STORE --> FINAL_EMIT[Emit: workflow:completed]
    end

    FINAL_EMIT --> RESULT[Return Warming Result]
    RESULT --> END([End])

    style CRON fill:#fff9c4,stroke:#f57c00
    style DEFAULT fill:#e8f5e9
    style CHUNK1 fill:#e3f2fd
    style W1_WAIT1 fill:#f5f5f5
    style CHUNK_WAIT fill:#f5f5f5
```

**Warming Schedule:**

```mermaid
gantt
    title Cache Warming Schedule (24-hour cycle)
    dateFormat HH:mm
    axisFormat %H:%M

    section Cron Triggers
    Cache Warm Run 1    :cron1, 00:00, 30m
    Cache Warm Run 2    :cron2, 06:00, 30m
    Cache Warm Run 3    :cron3, 12:00, 30m
    Cache Warm Run 4    :cron4, 18:00, 30m

    section Cache Validity
    EasyList Cache      :active, cache1, 00:00, 24h
    EasyPrivacy Cache   :active, cache2, 00:00, 24h
    AdGuard Cache       :active, cache3, 00:00, 24h
```

### HealthMonitoringWorkflow

Periodically checks availability and validity of upstream filter list sources.

```mermaid
flowchart TD
    subgraph "Trigger Sources"
        CRON[Cron: 0 * * * *<br/>Every hour]
        MANUAL[Manual: POST /workflow/health-check]
        ALERT_RECHECK[Alert-triggered Recheck]
    end

    subgraph "Initialization"
        CRON --> START
        MANUAL --> START
        ALERT_RECHECK --> START([HealthMonitoringWorkflow])
        START --> PARAMS{Custom Sources?}
        PARAMS -->|Yes| USE_CUSTOM[Use Provided Sources]
        PARAMS -->|No| USE_DEFAULT[Use Default Sources]
    end

    subgraph "Default Monitored Sources"
        USE_DEFAULT --> SOURCES[Default Sources]
        SOURCES --> S1[EasyList<br/>Expected: 50,000+ rules]
        SOURCES --> S2[EasyPrivacy<br/>Expected: 10,000+ rules]
        SOURCES --> S3[AdGuard Base<br/>Expected: 30,000+ rules]
        SOURCES --> S4[AdGuard Tracking<br/>Expected: 10,000+ rules]
        SOURCES --> S5[Peter Lowe's List<br/>Expected: 2,000+ rules]
    end

    subgraph "Step 1: load-health-history"
        USE_CUSTOM --> HISTORY
        S1 --> HISTORY
        S2 --> HISTORY
        S3 --> HISTORY
        S4 --> HISTORY
        S5 --> HISTORY
        HISTORY[Load Health History] --> HIST_FETCH[Fetch Last 30 Days]
        HIST_FETCH --> HIST_ANALYZE[Analyze Failure Patterns]
        HIST_ANALYZE --> HIST_EMIT[Emit: step:completed]
    end

    subgraph "Step 2-N: check-source-N"
        HIST_EMIT --> CHECK_LOOP[For Each Source]

        CHECK_LOOP --> CHECK_SRC[Step: check-source-N]
        CHECK_SRC --> EMIT_START[Emit: health:check:started]

        EMIT_START --> HTTP_REQ[HTTP HEAD/GET Request]
        HTTP_REQ --> MEASURE[Measure Response Time]

        MEASURE --> VALIDATE{Validate Response}

        VALIDATE --> V_STATUS{Status 200?}
        V_STATUS -->|No| MARK_UNHEALTHY[Mark Unhealthy<br/>Record Error]
        V_STATUS -->|Yes| V_TIME{Response < 30s?}
        V_TIME -->|No| MARK_SLOW[Mark Unhealthy<br/>Too Slow]
        V_TIME -->|Yes| V_RULES{Rules >= Expected?}
        V_RULES -->|No| MARK_LOW[Mark Unhealthy<br/>Low Rule Count]
        V_RULES -->|Yes| MARK_HEALTHY[Mark Healthy]

        MARK_UNHEALTHY --> RECORD
        MARK_SLOW --> RECORD
        MARK_LOW --> RECORD
        MARK_HEALTHY --> RECORD[Record Result]

        RECORD --> EMIT_DONE[Emit: health:check:completed]
        EMIT_DONE --> DELAY[Sleep 2s]
        DELAY --> MORE_SRC{More Sources?}
        MORE_SRC -->|Yes| CHECK_LOOP
        MORE_SRC -->|No| ANALYZE_STEP
    end

    subgraph "Step N+1: analyze-results"
        ANALYZE_STEP[Analyze All Results] --> CALC[Calculate Statistics]
        CALC --> CHECK_CONSEC{Consecutive<br/>Failures >= 3?}
        CHECK_CONSEC -->|Yes| NEED_ALERT[Flag for Alert]
        CHECK_CONSEC -->|No| NO_ALERT[No Alert Needed]
    end

    subgraph "Step N+2: send-alerts (conditional)"
        NEED_ALERT --> ALERT_CHECK{alertOnFailure?}
        ALERT_CHECK -->|Yes| SEND[Send Alert Notification]
        ALERT_CHECK -->|No| SKIP_ALERT[Skip Alert]
        NO_ALERT --> STORE_STEP
        SEND --> STORE_STEP
        SKIP_ALERT --> STORE_STEP
    end

    subgraph "Step N+3: store-results"
        STORE_STEP[Store Results] --> STORE_KV[Store in KV]
        STORE_KV --> STORE_AE[Track in Analytics]
        STORE_AE --> EMIT_COMPLETE[Emit: workflow:completed]
    end

    EMIT_COMPLETE --> RETURN[Return Health Report]
    RETURN --> END([End])

    style CRON fill:#fff9c4
    style MARK_HEALTHY fill:#c8e6c9
    style MARK_UNHEALTHY fill:#ffcdd2
    style MARK_SLOW fill:#ffcdd2
    style MARK_LOW fill:#ffcdd2
    style NEED_ALERT fill:#ffcdd2
```

**Health Check Response Structure:**

```mermaid
classDiagram
    class HealthCheckResult {
        +string runId
        +Date timestamp
        +SourceHealth[] results
        +HealthSummary summary
    }

    class SourceHealth {
        +string name
        +string url
        +boolean healthy
        +number statusCode
        +number responseTimeMs
        +number ruleCount
        +string? error
    }

    class HealthSummary {
        +number total
        +number healthy
        +number unhealthy
        +number avgResponseTimeMs
    }

    class HealthHistory {
        +Date[] timestamps
        +Map~string, boolean[]~ sourceResults
        +number consecutiveFailures
    }

    HealthCheckResult --> SourceHealth
    HealthCheckResult --> HealthSummary
    HealthCheckResult --> HealthHistory
```

### Workflow Events & Progress Tracking

Real-time progress tracking for all workflows using the WorkflowEvents system.

```mermaid
flowchart LR
    subgraph "Workflow Execution"
        WF[Any Workflow] --> EMIT[Event Emitter]
    end

    subgraph "Event Types"
        EMIT --> E1[workflow:started]
        EMIT --> E2[workflow:step:started]
        EMIT --> E3[workflow:step:completed]
        EMIT --> E4[workflow:step:failed]
        EMIT --> E5[workflow:progress]
        EMIT --> E6[workflow:completed]
        EMIT --> E7[workflow:failed]
        EMIT --> E8[source:fetch:started]
        EMIT --> E9[source:fetch:completed]
        EMIT --> E10[transformation:started]
        EMIT --> E11[transformation:completed]
        EMIT --> E12[cache:stored]
        EMIT --> E13[health:check:started]
        EMIT --> E14[health:check:completed]
    end

    subgraph "Event Storage"
        E1 --> KV[(KV: workflow:events:ID)]
        E2 --> KV
        E3 --> KV
        E4 --> KV
        E5 --> KV
        E6 --> KV
        E7 --> KV
        E8 --> KV
        E9 --> KV
        E10 --> KV
        E11 --> KV
        E12 --> KV
        E13 --> KV
        E14 --> KV
    end

    subgraph "Event Retrieval"
        KV --> API[GET /workflow/events/:id]
        API --> CLIENT[Client Polling]
    end

    style E6 fill:#c8e6c9
    style E7 fill:#ffcdd2
    style E4 fill:#ffcdd2
```

**Event Polling Sequence:**

```mermaid
sequenceDiagram
    participant Client
    participant API as /workflow/events/:id
    participant KV as Event Storage

    Note over Client,KV: Client starts polling for progress

    Client->>API: GET /workflow/events/wf-123
    API->>KV: Get events for wf-123
    KV-->>API: Events 1-3
    API-->>Client: {progress: 25%, events: [...]}

    Note over Client: Wait 2 seconds

    Client->>API: GET /workflow/events/wf-123?since=timestamp
    API->>KV: Get events since timestamp
    KV-->>API: Events 4-6
    API-->>Client: {progress: 60%, events: [...]}

    Note over Client: Wait 2 seconds

    Client->>API: GET /workflow/events/wf-123?since=timestamp
    API->>KV: Get events since timestamp
    KV-->>API: Events 7-8 (includes completed)
    API-->>Client: {progress: 100%, isComplete: true, events: [...]}

    Note over Client: Stop polling
```

**Event Storage Limits:**

| Parameter | Value | Notes |
|-----------|-------|-------|
| TTL | 1 hour | Events auto-expire |
| Max Events | 100 per workflow | Oldest truncated |
| Key Format | `workflow:events:{workflowId}` | |
| Consistency | Eventual | Acceptable for progress |

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

### Transformation Pipeline

The transformation pipeline applies a series of rule transformations in a fixed order.

```mermaid
flowchart TD
    subgraph "Input"
        INPUT[Raw Rules Array<br/>from Source Fetch]
    end

    subgraph "Pre-Processing"
        INPUT --> EXCLUSIONS{Has Exclusion<br/>Patterns?}
        EXCLUSIONS -->|Yes| APPLY_EXCL[Apply Exclusions<br/>Remove matching rules]
        EXCLUSIONS -->|No| INCLUSIONS
        APPLY_EXCL --> INCLUSIONS{Has Inclusion<br/>Patterns?}
        INCLUSIONS -->|Yes| APPLY_INCL[Apply Inclusions<br/>Keep only matching rules]
        INCLUSIONS -->|No| TRANSFORM_START
        APPLY_INCL --> TRANSFORM_START[Start Transformation Pipeline]
    end

    subgraph "Transformation Pipeline (Fixed Order)"
        TRANSFORM_START --> T1[1. ConvertToAscii<br/>Non-ASCII → Punycode]
        T1 --> T2[2. TrimLines<br/>Remove whitespace]
        T2 --> T3[3. RemoveComments<br/>Remove ! and # lines]
        T3 --> T4[4. Compress<br/>Hosts → Adblock syntax]
        T4 --> T5[5. RemoveModifiers<br/>Strip unsupported modifiers]
        T5 --> T6[6. InvertAllow<br/>@@ → blocking rules]
        T6 --> T7[7. Validate<br/>Remove dangerous rules]
        T7 --> T8[8. ValidateAllowIp<br/>Validate preserving IPs]
        T8 --> T9[9. Deduplicate<br/>Remove duplicate rules]
        T9 --> T10[10. RemoveEmptyLines<br/>Remove blank lines]
        T10 --> T11[11. InsertFinalNewLine<br/>Add trailing newline]
    end

    subgraph "Output"
        T11 --> OUTPUT[Transformed Rules Array]
    end

    style T1 fill:#e3f2fd
    style T2 fill:#e3f2fd
    style T3 fill:#e3f2fd
    style T4 fill:#fff8e1
    style T5 fill:#fff8e1
    style T6 fill:#fff8e1
    style T7 fill:#fce4ec
    style T8 fill:#fce4ec
    style T9 fill:#e8f5e9
    style T10 fill:#e8f5e9
    style T11 fill:#e8f5e9
```

**Transformation Details:**

```mermaid
flowchart LR
    subgraph "Text Processing"
        T1[ConvertToAscii]
        T2[TrimLines]
        T3[RemoveComments]
    end

    subgraph "Format Conversion"
        T4[Compress]
        T5[RemoveModifiers]
        T6[InvertAllow]
    end

    subgraph "Validation"
        T7[Validate]
        T8[ValidateAllowIp]
    end

    subgraph "Cleanup"
        T9[Deduplicate]
        T10[RemoveEmptyLines]
        T11[InsertFinalNewLine]
    end

    T1 --> T2 --> T3 --> T4 --> T5 --> T6 --> T7 --> T8 --> T9 --> T10 --> T11
```

| Transformation | Purpose | Example |
|----------------|---------|---------|
| **ConvertToAscii** | Punycode encoding | `ädblock.com` → `xn--dblock-bua.com` |
| **TrimLines** | Clean whitespace | `  rule  ` → `rule` |
| **RemoveComments** | Strip comments | `! Comment` → (removed) |
| **Compress** | Hosts to adblock | `0.0.0.0 ads.com` → `||ads.com^` |
| **RemoveModifiers** | Strip modifiers | `||ads.com$third-party` → `||ads.com` |
| **InvertAllow** | Convert exceptions | `@@||safe.com^` → `||safe.com^` |
| **Validate** | Remove dangerous | `||*` → (removed) |
| **ValidateAllowIp** | Validate + IPs | Keep `127.0.0.1` rules |
| **Deduplicate** | Remove duplicates | `||a.com^, ||a.com^` → `||a.com^` |
| **RemoveEmptyLines** | Clean blanks | (blank lines removed) |
| **InsertFinalNewLine** | Add newline | Ensure file ends with `\n` |

**Pattern Matching Optimization:**

```mermaid
flowchart TD
    subgraph "Pattern Classification"
        PATTERN[Exclusion/Inclusion Pattern] --> CHECK{Contains Wildcard?}
        CHECK -->|No| PLAIN[Plain String Pattern]
        CHECK -->|Yes| REGEX[Wildcard Pattern]
    end

    subgraph "Plain String Matching"
        PLAIN --> INCLUDES[String.includes]
        INCLUDES --> FAST[O(n) per rule<br/>Very Fast]
    end

    subgraph "Wildcard Pattern Matching"
        REGEX --> COMPILE[Compile to Regex]
        COMPILE --> WILDCARDS[* → .*<br/>? → .]
        WILDCARDS --> MATCH[RegExp.test]
        MATCH --> SLOWER[O(n) with regex overhead]
    end

    subgraph "Optimization"
        FAST --> SET[Use Set for O(1) lookups<br/>when checking requested transformations]
        SLOWER --> SET
    end

    style PLAIN fill:#c8e6c9
    style REGEX fill:#fff9c4
    style SET fill:#e1f5ff
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
