# End-to-End Integration Testing

Comprehensive visual testing dashboard for the Adblock Compiler API with real-time event reporting and WebSocket testing.

## 🎯 Overview

The E2E testing dashboard (`/e2e-tests.html`) provides:

- **15+ Integration Tests** covering all API endpoints
- **Real-time Visual Feedback** with color-coded status
- **WebSocket Testing** with live message display
- **Event Log** tracking all test activities
- **Performance Metrics** (response times, throughput)
- **Interactive Controls** (run all, stop, configure URL)

## 🚀 Quick Start

### Access the Dashboard

```bash
# Start the server
deno task dev

# Open the test dashboard
open http://localhost:8787/e2e-tests.html

# Or in production
open https://adblock-compiler.jayson-knight.workers.dev/e2e-tests.html
```

### Run Tests

1. **Configure API URL** (defaults to `http://localhost:8787`)
2. **Click "Run All Tests"** to execute the full suite
3. **Watch real-time progress** in the test cards
4. **Review event log** for detailed information
5. **Test WebSocket** separately with dedicated controls

## 📋 Test Coverage

### Core API Tests (6 tests)

| Test | Endpoint | Validates |
|------|----------|-----------|
| API Info | `GET /api` | Version info, endpoints list |
| Metrics | `GET /metrics` | Performance metrics structure |
| Simple Compile | `POST /compile` | Basic compilation flow |
| Transformations | `POST /compile` | Multiple transformations |
| Cache Test | `POST /compile` | Cache headers (X-Cache) |
| Batch Compile | `POST /compile/batch` | Parallel compilation |

### Streaming Tests (2 tests)

| Test | Endpoint | Validates |
|------|----------|-----------|
| SSE Stream | `POST /compile/stream` | Server-Sent Events delivery |
| Event Types | `POST /compile/stream` | Event format validation |

### Queue Tests (4 tests)

| Test | Endpoint | Validates |
|------|----------|-----------|
| Queue Stats | `GET /queue/stats` | Queue metrics |
| Async Compile | `POST /compile/async` | Job queuing (202 or 500) |
| Batch Async | `POST /compile/batch/async` | Batch job queuing |
| Queue Results | `GET /queue/results/{id}` | Result retrieval |

**Note:** Queue tests accept both `202` (queued) and `500` (not configured) responses since queues may not be available locally.

### Performance Tests (3 tests)

| Test | Validates |
|------|-----------|
| Response Time | `< 2 seconds` for API endpoint |
| Concurrent Requests | 5 parallel requests succeed |
| Large Batch | 10-item batch compilation |

## 🔌 WebSocket Testing

The dashboard includes dedicated WebSocket testing with visual feedback:

### Features

- **Connection Status** - Visual indicator (connected/disconnected/error)
- **Real-time Messages** - All WebSocket messages displayed
- **Progress Bar** - Visual compilation progress
- **Event Tracking** - Logs all connection/message events

### WebSocket Test Flow

```
1. Click "Connect WebSocket"
   → Establishes WS connection to /ws/compile

2. Click "Run WebSocket Test"
   → Sends compile request with sessionId
   → Receives real-time events:
     - welcome
     - compile:started
     - event (progress updates)
     - compile:complete

3. Click "Disconnect" when done
```

### WebSocket Events

The test validates:

- ✅ Connection establishment
- ✅ Welcome message reception
- ✅ Compile request acceptance
- ✅ Event streaming (source, transformation, progress)
- ✅ Completion notification
- ✅ Error handling

## 📊 Visual Features

### Test Status Colors

```
🔵 Pending  - Gray (waiting to run)
🟠 Running  - Orange (currently executing, animated pulse)
🟢 Passed   - Green (successful)
🔴 Failed   - Red (error occurred)
```

### Real-time Statistics

Dashboard displays:
- **Total Tests** - Number of tests in suite
- **Passed** - Successfully completed tests (green)
- **Failed** - Tests with errors (red)
- **Duration** - Total execution time

### Event Log

Color-coded terminal-style log showing:

- 🔵 **Info** (Blue) - Test starts, general information
- 🟢 **Success** (Green) - Test passes
- 🔴 **Error** (Red) - Test failures with error messages
- 🟠 **Warning** (Orange) - Non-critical issues

## 🧪 Test Implementation Details

### Test Structure

Each test includes:

```javascript
{
    id: 'test-id',              // Unique identifier
    name: 'Display Name',       // User-friendly name
    category: 'core',           // Test category
    status: 'pending',          // Current status
    duration: 0,                // Execution time (ms)
    error: null                 // Error message if failed
}
```

### Example Test

```javascript
async function testCompileSimple(baseUrl) {
    const body = {
        configuration: {
            name: 'E2E Test',
            sources: [{ source: 'test' }],
        },
        preFetchedContent: {
            test: '||example.com^'
        }
    };
    
    const response = await fetch(`${baseUrl}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success || !data.rules) throw new Error('Invalid response');
}
```

### Adding Custom Tests

1. Add test definition to `initializeTests()`:

```javascript
{ 
    id: 'my-test', 
    name: 'My Custom Test', 
    category: 'core', 
    status: 'pending', 
    duration: 0 
}
```

2. Implement test function:

```javascript
async function testMyCustomTest(baseUrl) {
    // Your test logic here
    const response = await fetch(`${baseUrl}/my-endpoint`);
    if (!response.ok) throw new Error(`Failed: ${response.status}`);
}
```

3. Add case to `runTest()` switch statement:

```javascript
case 'my-test':
    await testMyCustomTest(baseUrl);
    break;
```

## 🎨 UI Components

### Test Cards

Each category has a dedicated card:
- **Core API** - Core endpoints (6 tests)
- **Streaming** - SSE/WebSocket (2 tests)
- **Queue** - Async operations (4 tests)
- **Performance** - Speed/throughput (3 tests)

### Controls

- **API Base URL** - Configurable (local/production)
- **Run All Tests** - Execute full suite sequentially
- **Stop** - Abort running tests
- **WebSocket Controls** - Connect, test, disconnect

## 📈 Performance Validation

### Response Time Test

Validates API response time < 2 seconds:

```javascript
const start = Date.now();
const response = await fetch(`${baseUrl}/api`);
const duration = Date.now() - start;

if (duration > 2000) throw new Error(`Too slow: ${duration}ms`);
```

### Concurrent Requests Test

Verifies 5 parallel requests succeed:

```javascript
const promises = Array(5).fill(null).map(() => 
    fetch(`${baseUrl}/api`)
);

const responses = await Promise.all(promises);
const failures = responses.filter(r => !r.ok);

if (failures.length > 0) {
    throw new Error(`${failures.length}/5 failed`);
}
```

### Large Batch Test

Tests 10-item batch compilation:

```javascript
const requests = Array(10).fill(null).map((_, i) => ({
    id: `item-${i}`,
    configuration: { name: `Test ${i}`, sources: [...] },
    preFetchedContent: { ... }
}));

const response = await fetch(`${baseUrl}/compile/batch`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
});
```

## 🔍 Debugging

### View Test Details

Event log shows:
- Test start times
- Response times
- Error messages
- Cache hit/miss status
- Queue availability

### Common Issues

**All tests fail immediately:**
```
❌ Check server is running at configured URL
curl http://localhost:8787/api
```

**Queue tests return 500:**
```
⚠️ Expected - queues not configured locally
Deploy to Cloudflare Workers to test queue functionality
```

**WebSocket won't connect:**
```
❌ Check WebSocket endpoint is available
Ensure /ws/compile route is implemented
```

**SSE tests timeout:**
```
⚠️ Server may be slow or not streaming events
Check compile/stream endpoint implementation
```

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: denoland/setup-deno@v1
      
      - name: Start server
        run: deno task dev &
        
      - name: Wait for server
        run: sleep 5
      
      - name: Install Playwright
        run: npm install -g playwright
      
      - name: Run E2E tests
        run: |
          playwright test --headed \
            --base-url http://localhost:8787 \
            e2e-tests.html
```

### Automated Testing

Use Playwright or Puppeteer to automate:

```javascript
// example-playwright-test.js
const { test, expect } = require('@playwright/test');

test('E2E test suite passes', async ({ page }) => {
    await page.goto('http://localhost:8787/e2e-tests.html');
    
    // Click run all tests
    await page.click('#runAllBtn');
    
    // Wait for completion
    await page.waitForSelector('#runAllBtn:not([disabled])', {
        timeout: 60000
    });
    
    // Check stats
    const passed = await page.textContent('#passedTests');
    const failed = await page.textContent('#failedTests');
    
    expect(parseInt(failed)).toBe(0);
    expect(parseInt(passed)).toBeGreaterThan(0);
});
```

## 🛠️ Configuration

### Environment-specific URLs

```javascript
// Development
document.getElementById('apiUrl').value = 'http://localhost:8787';

// Staging
document.getElementById('apiUrl').value = 'https://staging.example.com';

// Production
document.getElementById('apiUrl').value = 'https://adblock-compiler.jayson-knight.workers.dev';
```

### Custom Test Timeout

Modify SSE test timeout:

```javascript
const timeout = setTimeout(() => {
    reader.cancel();
    resolve(); // or reject()
}, 5000); // 5 seconds instead of default 3
```

## 📚 Related Documentation

- [OpenAPI Tooling Guide](OPENAPI_TOOLING.md)
- [Contract Testing](../worker/openapi-contract.test.ts)
- [Postman Testing](POSTMAN_TESTING.md)
- [Queue Support](QUEUE_SUPPORT.md)
- [WebSocket Implementation](../worker/websocket.ts)

## 💡 Best Practices

1. **Run tests before committing**
   ```bash
   # Open dashboard and run tests
   open http://localhost:8787/e2e-tests.html
   ```

2. **Test against local server first**
   - Faster feedback
   - Doesn't consume production quotas
   - Easier debugging

3. **Use WebSocket test for real-time validation**
   - Verifies bidirectional communication
   - Tests event streaming
   - Validates session management

4. **Monitor event log for issues**
   - Cache behavior
   - Response times
   - Queue availability
   - Error messages

5. **Update tests when adding endpoints**
   - Add test definition
   - Implement test function
   - Add to switch statement
   - Update category count

## 🎯 Summary

The E2E testing dashboard provides:

✅ **Comprehensive Coverage** - All API endpoints tested  
✅ **Visual Feedback** - Real-time status and progress  
✅ **WebSocket Testing** - Dedicated real-time testing  
✅ **Event Tracking** - Complete audit log  
✅ **Performance Validation** - Response time and throughput  
✅ **Easy to Extend** - Simple test addition process  

Access it at: **http://localhost:8787/e2e-tests.html** 🚀
