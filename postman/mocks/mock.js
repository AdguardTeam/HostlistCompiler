const http = require('http');

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // GET /api
  // @endpoint GET /api
  if (method === 'GET' && url === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "name": "Adblock Compiler API", "version": "2.0.0", "endpoints": { "compile": "POST /compile", "stream": "POST /compile/stream", "batch": "POST /compile/batch", "async": "POST /compile/async", "health": "GET /health", "metrics": "GET /metrics", "ast": "POST /ast/parse" } }));
    return;
  }

  // GET /api/version
  // @endpoint GET /api/version
  if (method === 'GET' && url === '/api/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "version": "2.0.0", "buildNumber": 42, "fullVersion": "2.0.0+42", "gitCommit": "abc1234", "gitBranch": "main", "deployedAt": "2026-03-09 18:00:00", "deployedBy": "ci-pipeline", "status": "active" }));
    return;
  }

  // GET /api/deployments/stats
  // @endpoint GET /api/deployments/stats
  if (method === 'GET' && url === '/api/deployments/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "totalDeployments": 42, "successfulDeployments": 40, "failedDeployments": 2, "latestVersion": "2.0.0" }));
    return;
  }

  // GET /api/deployments
  // @endpoint GET /api/deployments
  if (method === 'GET' && url === '/api/deployments') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "deployments": [{ "version": "2.0.0", "buildNumber": 42, "fullVersion": "2.0.0+42", "gitCommit": "abc1234", "gitBranch": "main", "deployedAt": "2026-03-09 18:00:00", "deployedBy": "ci-pipeline", "status": "active", "metadata": null }], "count": 1 }));
    return;
  }

  // GET /api/turnstile-config
  // @endpoint GET /api/turnstile-config
  if (method === 'GET' && url === '/api/turnstile-config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "siteKey": null, "enabled": false }));
    return;
  }

  // POST /api/browser/resolve-url
  // @endpoint POST /api/browser/resolve-url
  if (method === 'POST' && url === '/api/browser/resolve-url') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "originalUrl": "https://example.com/filters.txt", "resolvedUrl": "https://example.com/filters.txt", "redirectChain": [], "statusCode": 200 }));
    });
    return;
  }

  // POST /api/browser/monitor
  // @endpoint POST /api/browser/monitor
  if (method === 'POST' && url === '/api/browser/monitor') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Monitor run complete", "results": [{ "url": "https://easylist.to/easylist/easylist.txt", "changed": false, "statusCode": 200, "checkedAt": "2026-03-10T02:52:45.653Z" }] }));
    });
    return;
  }

  // GET /api/browser/monitor/latest
  // @endpoint GET /api/browser/monitor/latest
  if (method === 'GET' && url === '/api/browser/monitor/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "results": [{ "url": "https://easylist.to/easylist/easylist.txt", "changed": false, "statusCode": 200, "checkedAt": "2026-03-10T02:52:45.653Z" }] }));
    return;
  }

  // POST /compile/stream
  // @endpoint POST /compile/stream
  if (method === 'POST' && url === '/compile/stream') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      res.end(
        'event: log\ndata: {"level":"info","message":"Starting compilation..."}\n\n' +
        'event: source:start\ndata: {"source":{"name":"Source 1","source":"https://example.com/filters.txt"},"sourceIndex":0,"totalSources":1}\n\n' +
        'event: source:complete\ndata: {"source":{"name":"Source 1","source":"https://example.com/filters.txt"},"ruleCount":4,"durationMs":210}\n\n' +
        'event: transformation:start\ndata: {"transformation":"RemoveComments"}\n\n' +
        'event: transformation:complete\ndata: {"transformation":"RemoveComments","inputCount":10,"outputCount":8,"durationMs":12}\n\n' +
        'event: progress\ndata: {"percent":90,"message":"Finalizing..."}\n\n' +
        'event: result\ndata: {"success":true,"rules":["||ads.example.com^","||tracking.example.com^","##.ad-banner","##.sponsored-content"],"ruleCount":4,"compiledAt":"2026-03-10T02:52:45.653Z"}\n\n' +
        'event: done\ndata: {}\n\n'
      );
    });
    return;
  }

  // POST /compile/batch/async
  // @endpoint POST /compile/batch/async
  if (method === 'POST' && url === '/compile/batch/async') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Batch job queued successfully", "requestId": "mock-batch-xyz789", "priority": "standard", "batchSize": 2, "note": "Use GET /queue/results/mock-batch-xyz789 to poll for results" }));
    });
    return;
  }

  // POST /compile/batch
  // @endpoint POST /compile/batch
  if (method === 'POST' && url === '/compile/batch') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "results": [{ "id": "req-1", "success": true, "rules": ["||ads.example.com^"], "ruleCount": 1, "compiledAt": "2026-03-10T02:52:45.653Z", "cached": false }, { "id": "req-2", "success": true, "rules": ["##.ad-banner", "##.sponsored-content"], "ruleCount": 2, "compiledAt": "2026-03-10T02:52:45.653Z", "cached": false }] }));
    });
    return;
  }

  // POST /compile/async
  // @endpoint POST /compile/async
  if (method === 'POST' && url === '/compile/async') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Job queued successfully", "requestId": "mock-req-abc123", "priority": "standard", "note": "Use GET /queue/results/mock-req-abc123 to poll for results" }));
    });
    return;
  }

  // POST /compile
  // @endpoint POST /compile
  if (method === 'POST' && url === '/compile') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
      res.end(JSON.stringify({ "success": true, "rules": ["||ads.example.com^", "||tracking.example.com^", "##.ad-banner", "##.sponsored-content"], "ruleCount": 4, "metrics": { "totalDurationMs": 312, "sourceCount": 1, "ruleCount": 4, "transformationMetrics": [{ "name": "RemoveComments", "inputCount": 10, "outputCount": 8, "durationMs": 12 }, { "name": "Deduplicate", "inputCount": 8, "outputCount": 4, "durationMs": 8 }] }, "compiledAt": "2026-03-10T02:52:45.653Z", "cached": false, "deduplicated": false }));
    });
    return;
  }

  // GET /health/latest
  // @endpoint GET /health/latest
  if (method === 'GET' && url === '/health/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "timestamp": "2026-03-10T02:52:45.653Z", "runId": "mock-run-001", "results": [{ "name": "EasyList", "url": "https://easylist.to/easylist/easylist.txt", "healthy": true, "statusCode": 200, "responseTimeMs": 312, "ruleCount": 75000, "error": null, "lastChecked": "2026-03-10T02:52:45.653Z" }], "summary": { "total": 1, "healthy": 1, "unhealthy": 0 } }));
    return;
  }

  // GET /health
  // @endpoint GET /health
  if (method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "status": "healthy", "version": "2.0.0" }));
    return;
  }

  // GET /metrics
  // @endpoint GET /metrics
  if (method === 'GET' && url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "window": "1h", "timestamp": "2026-03-10T02:52:45.653Z", "endpoints": { "/compile": { "count": 42, "success": 40, "failed": 2, "avgDuration": 287.5, "errors": { "500": 2 } }, "/compile/batch": { "count": 8, "success": 8, "failed": 0, "avgDuration": 512.3, "errors": {} } } }));
    return;
  }

  // GET /queue/stats
  // @endpoint GET /queue/stats
  if (method === 'GET' && url === '/queue/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "pending": 2, "completed": 150, "failed": 3, "cancelled": 1, "totalProcessingTime": 45000, "averageProcessingTime": 290, "processingRate": 12.5, "queueLag": 45, "lastUpdate": "2026-03-10T02:52:45.653Z", "history": [], "depthHistory": [] }));
    return;
  }

  // GET /queue/history
  // @endpoint GET /queue/history
  if (method === 'GET' && url === '/queue/history') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "history": [{ "requestId": "mock-req-abc123", "configName": "Mock Config", "status": "completed", "duration": 312, "timestamp": "2026-03-10T02:52:45.653Z", "ruleCount": 4 }], "depthHistory": [{ "timestamp": "2026-03-10T02:52:45.653Z", "pending": 0 }] }));
    return;
  }

  // GET /queue/results/:id
  // @endpoint GET /queue/results/:id
  if (method === 'GET' && url.startsWith('/queue/results/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "status": "completed", "jobInfo": { "configName": "Mock Config", "duration": 312, "timestamp": "2026-03-10T02:52:45.653Z", "error": null } }));
    return;
  }

  // DELETE /queue/cancel/:id
  // @endpoint DELETE /queue/cancel/:id
  if (method === 'DELETE' && url.startsWith('/queue/cancel/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "message": "Job cancellation requested", "note": "Job may still process if already started" }));
    return;
  }

  // POST /ast/parse
  // @endpoint POST /ast/parse
  if (method === 'POST' && url === '/ast/parse') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "parsedRules": [{ "type": "network", "pattern": "||ads.example.com^", "options": {}, "raw": "||ads.example.com^" }, { "type": "cosmetic", "pattern": ".ad-banner", "action": "hide", "raw": "##.ad-banner" }], "summary": { "total": 2, "byType": { "network": 1, "cosmetic": 1 }, "parseErrors": 0 } }));
    });
    return;
  }

  // GET /admin/storage/stats
  // @endpoint GET /admin/storage/stats
  if (method === 'GET' && url === '/admin/storage/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "stats": { "storage_entries": 42, "filter_cache": 18, "compilation_metadata": 24, "expired_storage": 2, "expired_cache": 1 }, "timestamp": "2026-03-10T02:52:45.653Z" }));
    return;
  }

  // GET /admin/storage/export
  // @endpoint GET /admin/storage/export
  if (method === 'GET' && url === '/admin/storage/export') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "exportedAt": "2026-03-10T02:52:45.653Z", "storage_entries": [], "filter_cache": [], "compilation_metadata": [] }));
    return;
  }

  // GET /admin/storage/tables
  // @endpoint GET /admin/storage/tables
  if (method === 'GET' && url === '/admin/storage/tables') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "tables": [{ "name": "storage_entries", "type": "table" }, { "name": "filter_cache", "type": "table" }, { "name": "compilation_metadata", "type": "table" }] }));
    return;
  }

  // POST /admin/storage/clear-expired
  // @endpoint POST /admin/storage/clear-expired
  if (method === 'POST' && url === '/admin/storage/clear-expired') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "deleted": 3, "message": "Expired entries cleared" }));
    });
    return;
  }

  // POST /admin/storage/vacuum
  // @endpoint POST /admin/storage/vacuum
  if (method === 'POST' && url === '/admin/storage/vacuum') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Database vacuumed successfully" }));
    });
    return;
  }

  // POST /admin/storage/clear
  // @endpoint POST /admin/storage/clear
  if (method === 'POST' && url === '/admin/storage/clear') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "deleted": 18, "message": "Cache cleared successfully" }));
    });
    return;
  }

  // POST /admin/storage/query
  // @endpoint POST /admin/storage/query
  if (method === 'POST' && url === '/admin/storage/query') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "rows": [], "rowCount": 0, "meta": { "columns": [], "executionTimeMs": 1 } }));
    });
    return;
  }

  // GET /admin/pg/stats
  // @endpoint GET /admin/pg/stats
  if (method === 'GET' && url === '/admin/pg/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "stats": { "storage_entries": 10, "filter_cache": 5, "compilation_metadata": 5, "expired_storage": 0, "expired_cache": 0 }, "timestamp": "2026-03-10T02:52:45.653Z" }));
    return;
  }

  // GET /admin/pg/export
  // @endpoint GET /admin/pg/export
  if (method === 'GET' && url === '/admin/pg/export') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "exportedAt": "2026-03-10T02:52:45.653Z", "storage_entries": [], "filter_cache": [], "compilation_metadata": [] }));
    return;
  }

  // POST /admin/pg/clear-expired
  // @endpoint POST /admin/pg/clear-expired
  if (method === 'POST' && url === '/admin/pg/clear-expired') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "deleted": 0, "message": "No expired PG entries found" }));
    });
    return;
  }

  // POST /admin/pg/clear
  // @endpoint POST /admin/pg/clear
  if (method === 'POST' && url === '/admin/pg/clear') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "deleted": 5, "message": "PG cache cleared successfully" }));
    });
    return;
  }

  // POST /admin/pg/query
  // @endpoint POST /admin/pg/query
  if (method === 'POST' && url === '/admin/pg/query') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "rows": [], "rowCount": 0, "meta": { "columns": [], "executionTimeMs": 2 } }));
    });
    return;
  }

  // POST /admin/migrate
  // @endpoint POST /admin/migrate
  if (method === 'POST' && url === '/admin/migrate') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Migration completed successfully", "deleted": 0 }));
    });
    return;
  }

  // GET /admin/status
  // @endpoint GET /admin/status
  if (method === 'GET' && url === '/admin/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "backends": { "d1": { "status": "healthy", "latencyMs": 12 }, "postgresql": { "status": "healthy", "latencyMs": 8 }, "kv": { "status": "healthy", "latencyMs": 3 } } }));
    return;
  }

  // GET /admin/auth/keys
  // @endpoint GET /admin/auth/keys
  if (method === 'GET' && url === '/admin/auth/keys') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "keys": [{ "id": "key-mock-001", "name": "Mock API Key", "role": "admin", "createdAt": "2026-03-01T00:00:00.000Z", "lastUsed": "2026-03-10T02:52:45.653Z" }] }));
    return;
  }

  // POST /admin/auth/keys/validate — must be before DELETE /admin/auth/keys/:id prefix
  // @endpoint POST /admin/auth/keys/validate
  if (method === 'POST' && url === '/admin/auth/keys/validate') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "valid": true, "role": "admin", "name": "Mock API Key" }));
    });
    return;
  }

  // POST /admin/auth/keys
  // @endpoint POST /admin/auth/keys
  if (method === 'POST' && url === '/admin/auth/keys') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "key": "mock-api-key-abc123xyz", "id": "key-mock-002", "name": "New Mock Key", "role": "user" }));
    });
    return;
  }

  // DELETE /admin/auth/keys/:id
  // @endpoint DELETE /admin/auth/keys/:id
  if (method === 'DELETE' && url.startsWith('/admin/auth/keys/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "message": "API key revoked" }));
    return;
  }

  // POST /admin/auth/users
  // @endpoint POST /admin/auth/users
  if (method === 'POST' && url === '/admin/auth/users') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "data": { "id": "user-mock-001", "email": "mock@example.com", "displayName": "Mock User", "role": "user", "createdAt": "2026-03-10T02:52:45.653Z" } }));
    });
    return;
  }

  // GET /workflow/metrics
  // @endpoint GET /workflow/metrics
  if (method === 'GET' && url === '/workflow/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "timestamp": "2026-03-10T02:52:45.653Z", "workflows": { "compilation": { "count": 10, "successRate": 0.9, "avgDurationMs": 350 }, "batchCompilation": { "count": 3, "successRate": 1.0, "avgDurationMs": 820 }, "cacheWarming": { "count": 2, "successRate": 1.0, "avgDurationMs": 1200 }, "healthMonitoring": { "count": 5, "successRate": 0.8, "avgDurationMs": 500 } } }));
    return;
  }

  // GET /workflow/status/:type/:id
  // @endpoint GET /workflow/status/:type/:id
  if (method === 'GET' && url.startsWith('/workflow/status/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "workflowId": "wf-mock-001", "workflowType": "compilation", "status": "completed", "output": { "ruleCount": 4 }, "error": null }));
    return;
  }

  // GET /workflow/events/:id
  // @endpoint GET /workflow/events/:id
  if (method === 'GET' && url.startsWith('/workflow/events/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ "success": true, "workflowId": "wf-mock-001", "workflowType": "compilation", "startedAt": "2026-03-10T02:52:00.000Z", "completedAt": "2026-03-10T02:52:45.653Z", "progress": 100, "isComplete": true, "events": [{ "type": "step", "workflowId": "wf-mock-001", "workflowType": "compilation", "timestamp": "2026-03-10T02:52:00.000Z", "step": "fetch-sources", "progress": 50, "message": "Fetching sources", "data": {} }, { "type": "step", "workflowId": "wf-mock-001", "workflowType": "compilation", "timestamp": "2026-03-10T02:52:45.653Z", "step": "compile", "progress": 100, "message": "Compilation complete", "data": { "ruleCount": 4 } }] }));
    return;
  }

  // POST /workflow/compile
  // @endpoint POST /workflow/compile
  if (method === 'POST' && url === '/workflow/compile') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Compilation workflow started", "workflowId": "wf-mock-compile-001", "workflowType": "compilation" }));
    });
    return;
  }

  // POST /workflow/batch
  // @endpoint POST /workflow/batch
  if (method === 'POST' && url === '/workflow/batch') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Batch compilation workflow started", "workflowId": "wf-mock-batch-001", "workflowType": "batch-compilation", "batchSize": 2 }));
    });
    return;
  }

  // POST /workflow/cache-warm
  // @endpoint POST /workflow/cache-warm
  if (method === 'POST' && url === '/workflow/cache-warm') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Cache warming workflow started", "workflowId": "wf-mock-warm-001", "workflowType": "cache-warming", "configurationsCount": "default" }));
    });
    return;
  }

  // POST /workflow/health-check
  // @endpoint POST /workflow/health-check
  if (method === 'POST' && url === '/workflow/health-check') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ "success": true, "message": "Health monitoring workflow started", "workflowId": "wf-mock-health-001", "workflowType": "health-monitoring", "sourcesCount": "default" }));
    });
    return;
  }

  // GET /agents/mcp-agent/:instanceId/sse
  // @endpoint GET /agents/mcp-agent/:instanceId/sse
  if (method === 'GET' && url.startsWith('/agents/mcp-agent/') && url.includes('/sse')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.end('event: ready\ndata: {"protocol":"mcp","version":"1.0","agent":"playwright-mcp","instance":"default"}\n\n');
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Mock route not defined', method, url }));
});

const PORT = process.env.PORT || 4500;
server.listen(PORT, () => console.log('Mock server running on port ' + PORT));
