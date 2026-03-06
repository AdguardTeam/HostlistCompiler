# Streaming API Documentation

The adblock-compiler now provides comprehensive real-time event streaming capabilities through Server-Sent Events (SSE) and WebSocket connections, with enhanced diagnostic, cache, network, and performance metric events.

## Overview

### Enhanced Event Types

Both SSE and WebSocket endpoints now stream:

1. **Compilation Events**: Source downloads, transformations, progress
2. **Diagnostic Events**: Tracing system events with severity levels
3. **Cache Events**: Cache hit/miss/write operations
4. **Network Events**: HTTP requests with timing and size
5. **Performance Metrics**: Download speeds, processing times, etc.

## Server-Sent Events (SSE)

### Endpoint
```
POST /compile/stream
```

### Enhanced Event Types

#### Standard Compilation Events
- `log` - Log messages with levels (info, warn, error, debug)
- `source:start` - Source download started
- `source:complete` - Source download completed
- `source:error` - Source download failed
- `transformation:start` - Transformation started
- `transformation:complete` - Transformation completed with metrics
- `progress` - Compilation progress updates
- `result` - Final compilation result
- `done` - Compilation finished
- `error` - Compilation error

#### New Enhanced Events
- `diagnostic` - Diagnostic events from tracing system
- `cache` - Cache operations (hit/miss/write/evict)
- `network` - Network operations (HTTP requests)
- `metric` - Performance metrics

### Example: Diagnostic Event
```
event: diagnostic
data: {
  "eventId": "evt-abc123",
  "timestamp": "2026-01-14T05:00:00Z",
  "category": "compilation",
  "severity": "info",
  "message": "Started source download",
  "correlationId": "comp-xyz789",
  "metadata": {
    "sourceName": "AdGuard DNS Filter",
    "sourceUrl": "https://..."
  }
}
```

### Example: Cache Event
```
event: cache
data: {
  "eventId": "evt-cache-1",
  "category": "cache",
  "operation": "hit",
  "key": "cache:abc123xyz",
  "size": 51200
}
```

### Example: Network Event
```
event: network
data: {
  "method": "GET",
  "url": "https://example.com/filters.txt",
  "statusCode": 200,
  "durationMs": 234,
  "responseSize": 51200
}
```

### Example: Performance Metric
```
event: metric
data: {
  "metric": "download_speed",
  "value": 218.5,
  "unit": "KB/s",
  "dimensions": {
    "source": "AdGuard DNS Filter"
  }
}
```

## WebSocket API

### Endpoint
```
GET /ws/compile
```

WebSocket provides bidirectional communication for real-time compilation with cancellation support.

### Features
- ✅ Up to 3 concurrent compilations per connection
- ✅ Real-time progress streaming with all event types
- ✅ Cancellation support for running compilations
- ✅ Automatic heartbeat (30s interval)
- ✅ Connection timeout (5 minutes idle)
- ✅ Session-based compilation tracking

### Client → Server Messages

#### Compile Request
```json
{
  "type": "compile",
  "sessionId": "my-session-1",
  "configuration": {
    "name": "My Filter List",
    "sources": [
      {
        "source": "https://example.com/filters.txt",
        "transformations": ["RemoveComments", "Validate"]
      }
    ],
    "transformations": ["Deduplicate"]
  },
  "benchmark": true
}
```

#### Cancel Request
```json
{
  "type": "cancel",
  "sessionId": "my-session-1"
}
```

#### Ping (Heartbeat)
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Welcome Message
```json
{
  "type": "welcome",
  "version": "2.0.0",
  "connectionId": "ws-1737016800-abc123",
  "capabilities": {
    "maxConcurrentCompilations": 3,
    "supportsPauseResume": false,
    "supportsStreaming": true
  }
}
```

#### Compilation Started
```json
{
  "type": "compile:started",
  "sessionId": "my-session-1",
  "configurationName": "My Filter List"
}
```

#### Event Message
All SSE-style events are wrapped in an event message:
```json
{
  "type": "event",
  "sessionId": "my-session-1",
  "eventType": "diagnostic|cache|network|metric|source:start|...",
  "data": { /* event-specific data */ }
}
```

#### Compilation Complete
```json
{
  "type": "compile:complete",
  "sessionId": "my-session-1",
  "rules": ["||ads.example.com^", "||tracking.example.com^"],
  "ruleCount": 2,
  "metrics": {
    "totalDurationMs": 1234,
    "sourceCount": 1,
    "ruleCount": 2
  },
  "compiledAt": "2026-01-14T05:00:00Z"
}
```

#### Error Messages
```json
{
  "type": "compile:error",
  "sessionId": "my-session-1",
  "error": "Failed to fetch source",
  "details": {
    "stack": "..."
  }
}
```

```json
{
  "type": "error",
  "error": "Maximum concurrent compilations reached",
  "code": "TOO_MANY_COMPILATIONS",
  "sessionId": "my-session-1"
}
```

## JavaScript Client Examples

### SSE Client
```javascript
const eventSource = new EventSource('/compile/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    configuration: {
      name: 'My List',
      sources: [{ source: 'https://example.com/filters.txt' }]
    }
  })
});

// Listen to all event types
['log', 'source:start', 'diagnostic', 'cache', 'network', 'metric', 'result', 'done'].forEach(event => {
  eventSource.addEventListener(event, (e) => {
    const data = JSON.parse(e.data);
    console.log(`[${event}]`, data);
  });
});

eventSource.addEventListener('error', (e) => {
  console.error('SSE Error:', e);
});
```

### WebSocket Client
```javascript
const ws = new WebSocket('ws://localhost:8787/ws/compile');

ws.onopen = () => {
  // Start compilation
  ws.send(JSON.stringify({
    type: 'compile',
    sessionId: 'session-' + Date.now(),
    configuration: {
      name: 'My Filter List',
      sources: [
        { source: 'https://example.com/filters.txt' }
      ],
      transformations: ['Deduplicate']
    },
    benchmark: true
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'welcome':
      console.log('Connected:', message.connectionId);
      break;
      
    case 'compile:started':
      console.log('Compilation started:', message.sessionId);
      break;
      
    case 'event':
      // Handle all event types
      console.log(`[${message.eventType}]`, message.data);
      if (message.eventType === 'diagnostic') {
        console.log('Diagnostic:', message.data.message);
      } else if (message.eventType === 'cache') {
        console.log('Cache operation:', message.data.operation);
      } else if (message.eventType === 'network') {
        console.log('Network request:', message.data.url, message.data.durationMs + 'ms');
      } else if (message.eventType === 'metric') {
        console.log('Metric:', message.data.metric, message.data.value, message.data.unit);
      }
      break;
      
    case 'compile:complete':
      console.log('Complete:', message.ruleCount, 'rules');
      console.log('Metrics:', message.metrics);
      break;
      
    case 'compile:error':
      console.error('Error:', message.error);
      break;
  }
};

// Cancel compilation after 5 seconds
setTimeout(() => {
  ws.send(JSON.stringify({
    type: 'cancel',
    sessionId: 'session-123'
  }));
}, 5000);

// Send heartbeat every 30 seconds
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

## Visual Testing

An interactive WebSocket test page is available:

```
http://localhost:8787/websocket-test.html
```

Features:
- 🔗 Connection management
- ⚙️ Compile request builder with quick configs
- 📋 Real-time event log with color coding
- 📊 Live statistics (events, sessions, rules)
- 💻 Example code snippets

## Event Categories

### Diagnostic Events
```typescript
{
  eventId: string;
  timestamp: string;
  category: 'compilation' | 'download' | 'transformation' | 'cache' | 'validation' | 'network' | 'performance' | 'error';
  severity: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
```

### Cache Events
```typescript
{
  operation: 'hit' | 'miss' | 'write' | 'evict';
  key: string; // hashed for privacy
  size?: number; // bytes
}
```

### Network Events
```typescript
{
  method: string;
  url: string; // sanitized
  statusCode?: number;
  durationMs?: number;
  responseSize?: number; // bytes
}
```

### Performance Metrics
```typescript
{
  metric: string; // e.g., 'download_speed', 'parse_time'
  value: number;
  unit: string; // e.g., 'KB/s', 'ms', 'count'
  dimensions?: Record<string, string>; // for grouping
}
```

## OpenAPI Specification

A comprehensive OpenAPI 3.0 specification is available at:
```
/openapi.yaml
```

This includes:
- All REST endpoints
- Complete request/response schemas
- SSE event schemas
- WebSocket protocol documentation
- Security schemes
- Example requests

## Best Practices

### SSE
- ✅ Use for one-way streaming from server to client
- ✅ Automatic reconnection built into browser EventSource
- ✅ Simpler protocol, easier to debug
- ❌ Cannot cancel running compilations
- ❌ Limited to single compilation per connection

### WebSocket
- ✅ Use for bidirectional communication
- ✅ Cancel running compilations
- ✅ Multiple concurrent compilations per connection
- ✅ Lower latency than SSE
- ❌ More complex protocol
- ❌ Requires manual reconnection logic

### Performance
- Monitor `metric` events for download speeds and processing times
- Watch `cache` events to optimize cache hit rates
- Track `network` events to identify slow sources
- Use `diagnostic` events for debugging issues

## Error Handling

### SSE Errors
```javascript
eventSource.addEventListener('error', (e) => {
  console.error('Connection lost, attempting to reconnect...');
  // EventSource automatically reconnects
});
```

### WebSocket Errors
```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  if (!event.wasClean) {
    // Implement exponential backoff reconnection
    setTimeout(() => {
      connect(); // Your connection function
    }, 1000 * Math.pow(2, retryCount));
  }
};
```

## Rate Limits

Both endpoints are subject to rate limiting:
- **10 requests per minute per IP**
- Response: `429 Too Many Requests`
- Header: `Retry-After: 60`

WebSocket connections:
- **3 concurrent compilations max per connection**
- **5 minute idle timeout**
- Heartbeat required every 30 seconds

## See Also

- [OpenAPI Specification](../openapi.yaml)
- [API Documentation](../docs/api/README.md)
- [WebSocket Test Page](http://localhost:8787/websocket-test.html)
- [GitHub Repository](https://github.com/jaypatrick/adblock-compiler)
