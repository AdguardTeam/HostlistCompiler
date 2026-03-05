# Admin Dashboard

The Adblock Compiler Admin Dashboard is the main landing page that provides a centralized control panel for managing, testing, and monitoring the filter list compilation service.

## Overview

The dashboard is accessible at the root URL (`/`) and provides:

- **Real-time metrics** - Monitor compilation requests, queue depth, cache performance, and response times
- **Navigation hub** - Quick access to all tools and test pages
- **Notification system** - Browser notifications for async compilation jobs
- **Queue visualization** - Chart.js-powered queue depth tracking
- **Quick actions** - Common administrative tasks

## Features

### 📊 Real-time Metrics

The dashboard displays four key metrics that update automatically:

1. **Total Requests** - Cumulative API requests processed
2. **Queue Depth** - Current number of pending compilation jobs
3. **Cache Hit Rate** - Percentage of requests served from cache
4. **Avg Response Time** - Average compilation response time in milliseconds

Metrics refresh automatically every 30 seconds and can be manually refreshed using the "Refresh" button.

### 🚀 Main Tools

Quick navigation cards to primary tools:

- **Filter List Compiler** (`/compiler.html`) - Interactive UI for compiling filter lists with real-time progress
- **API Test Suite** (`/test.html`) - Test API endpoints with various configurations
- **E2E Integration Tests** (`/e2e-tests.html`) - End-to-end testing of all compiler features

### ⚡ Real-time & Performance

Advanced features and demonstrations:

#### WebSocket Demo (`/websocket-test.html`)

WebSocket endpoint demonstration showing **bidirectional real-time compilation**.

**Use WebSocket when:**
- You need full-duplex communication
- Lower latency is critical
- You want to send data both ways (client → server, server → client)
- Building interactive applications requiring instant feedback

**Benefits over other approaches:**
- Lower latency than Server-Sent Events (SSE)
- True bidirectional communication
- Better for real-time interactive applications
- Connection stays open for multiple operations

#### Benchmarks

Access to performance benchmarks for:
- String utilities performance
- Wildcard matching speed
- Rule parsing efficiency
- Transformation throughput

Run benchmarks via CLI:
```bash
deno task bench                      # All benchmarks
deno task bench:utils                # String & utility benchmarks
deno task bench:transformations      # Transformation benchmarks
```

#### Endpoint Comparison

Understanding when to use each compilation endpoint:

| Endpoint | Type | Use Case |
|----------|------|----------|
| `POST /compile` | JSON | Simple compilation with immediate JSON response |
| `POST /compile/stream` | SSE | Server-Sent Events for one-way progress updates |
| `GET /ws/compile` | WebSocket | Bidirectional real-time with interactive feedback |
| `POST /compile/async` | Queue | Background processing for long-running jobs |

**Choose:**
- **JSON** - Simple, fire-and-forget compilations
- **SSE** - Progress tracking with unidirectional updates
- **WebSocket** - Interactive applications needing bidirectional communication
- **Queue** - Background jobs that don't need immediate results

### 🔔 Notification System

The dashboard includes a browser notification system for tracking async compilation jobs.

#### Features

- **Browser notifications** - Native OS notifications when jobs complete
- **In-page toasts** - Visual notifications within the dashboard
- **Job tracking** - Automatic monitoring of queued compilation jobs
- **Persistent state** - Notifications work across page refreshes

#### How to Enable

1. Click the notification toggle in the dashboard
2. Allow browser notifications when prompted
3. Tracked async jobs will trigger notifications upon completion

#### Notification Types

- **Success** (Green) - Job completed successfully
- **Error** (Red) - Job failed with error
- **Warning** (Yellow) - Important information
- **Info** (Blue) - General updates

Notifications appear in two forms:
1. **Browser/OS notifications** - Native system notifications (when enabled)
2. **In-page toasts** - Slide-in notifications in the top-right corner

#### Tracking Async Jobs

When you submit an async compilation job (via `/compile/async` or `/compile/batch/async`), the dashboard:

1. Stores the `requestId` in local storage
2. Polls queue stats every 10 seconds
3. Detects when the job completes
4. Shows both browser and in-page notifications
5. Displays completion time and configuration name

Jobs are automatically cleaned up 1 hour after creation.

### 📈 Queue Monitoring

Real-time visualization of queue depth over time using Chart.js:

- Line chart showing queue depth history
- Last 20 data points displayed
- Auto-updates every 30 seconds
- Responsive design

### ⚡ Quick Actions

One-click access to common tasks:

- **API Docs** - View full API documentation
- **View Metrics** - Raw metrics JSON endpoint
- **Queue Stats** - Detailed queue statistics
- **Clear Cache** - Cache management (admin only)

### 🗄️ PostgreSQL Administration

Admin endpoints for managing the PlanetScale PostgreSQL backend via Cloudflare Hyperdrive. All endpoints require `Authorization: Bearer <ADMIN_KEY>` and a configured `HYPERDRIVE` binding.

#### Backend Health

- **`GET /admin/backends`** — Returns health status and latency for both D1 and PostgreSQL backends. Useful for verifying connectivity during the D1→PostgreSQL transition.

#### PostgreSQL Storage (`/admin/pg/*`)

| Endpoint | Description |
|----------|-------------|
| `GET /admin/pg/stats` | Storage statistics (mirrors `/admin/storage/stats`) |
| `GET /admin/pg/export` | Export data from PostgreSQL |
| `POST /admin/pg/clear-expired` | Remove expired entries |
| `POST /admin/pg/clear-cache` | Clear the filter cache |
| `POST /admin/pg/query` | Execute a read-only SQL query |

#### D1 → PostgreSQL Migration

- **`POST /admin/migrate/d1-to-pg`** — One-time migration that reads from Cloudflare D1 and writes to PlanetScale via Hyperdrive. Migrates three shared tables: `storage_entries`, `filter_cache`, and `compilation_metadata`.

  | Query parameter | Description |
  |-----------------|-------------|
  | `dryRun=true` | Preview row counts without writing |
  | `tables=t1,t2` | Migrate only the specified tables |

  Response includes per-table stats: `sourceCount`, `migratedCount`, `skippedCount`, `errorCount`, `durationMs`.

#### API Key Management (`/admin/auth/*`)

Endpoints for managing users and API keys backed by PostgreSQL. Requires `HYPERDRIVE` binding.

| Endpoint | Description |
|----------|-------------|
| `POST /admin/auth/users` | Create a new user |
| `GET /admin/auth/api-keys` | List API keys |
| `POST /admin/auth/api-keys` | Create a new API key (returns `abc_…` bearer token once) |
| `POST /admin/auth/api-keys/:id/revoke` | Revoke an API key |
| `POST /admin/auth/api-keys/validate` | Validate a bearer token |

## File Structure Changes

The admin dashboard is part of a reorganization of the public files:

**Before:**
```
public/
  index.html          # Compiler UI
  test.html
  e2e-tests.html
  websocket-test.html
```

**After:**
```
public/
  index.html          # Admin Dashboard (NEW - landing page)
  compiler.html       # Compiler UI (renamed from index.html)
  test.html
  e2e-tests.html
  websocket-test.html
```

## Auto-refresh

The dashboard automatically refreshes data every 30 seconds:

- Metrics (requests, cache, response time)
- Queue statistics and depth
- Queue depth chart updates
- Async job monitoring (every 10 seconds)

Manual refresh is available via the "Refresh" button in the queue chart section.

## API Endpoints Used

The dashboard makes calls to the following endpoints:

- `GET /metrics` - Performance and request metrics
- `GET /queue/stats` - Queue depth, history, and job status
- `GET /queue/history` - Historical queue depth data

**Admin (require `Authorization: Bearer <ADMIN_KEY>`):**

- `GET /admin/backends` - Backend health check (D1 + PostgreSQL)
- `GET /admin/pg/stats` - PostgreSQL storage statistics
- `GET /admin/pg/export` - PostgreSQL data export
- `POST /admin/pg/clear-expired` - Remove expired PostgreSQL entries
- `POST /admin/pg/clear-cache` - Clear PostgreSQL filter cache
- `POST /admin/pg/query` - Read-only PostgreSQL query
- `POST /admin/migrate/d1-to-pg` - D1 → PostgreSQL one-time migration
- `POST /admin/auth/users` - Create user
- `GET /admin/auth/api-keys` - List API keys
- `POST /admin/auth/api-keys` - Create API key
- `POST /admin/auth/api-keys/:id/revoke` - Revoke API key
- `POST /admin/auth/api-keys/validate` - Validate bearer token

## Browser Compatibility

The dashboard uses modern web features:

- **Chart.js 4.4.1** - For queue visualization
- **Notification API** - For browser notifications (optional)
- **LocalStorage** - For persistent settings and job tracking
- **Fetch API** - For API calls
- **CSS Grid & Flexbox** - For responsive layout

**Supported browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Customization

### Theme Colors

CSS custom properties (defined in `:root`):

```css
--primary: #667eea;
--secondary: #764ba2;
--success: #10b981;
--danger: #ef4444;
--warning: #f59e0b;
--info: #3b82f6;
```

### Refresh Intervals

To adjust auto-refresh timing, modify the JavaScript:

```javascript
// Auto-refresh metrics (default: 30 seconds)
setInterval(refreshMetrics, 30000);

// Monitor async jobs (default: 10 seconds)
setInterval(async () => { /* ... */ }, 10000);
```

## Security

- **Rate limiting** - Applied to compilation endpoints
- **CORS** - Configured for cross-origin access
- **Turnstile** - Optional bot protection
- **No sensitive data** - Dashboard displays public metrics only

## Performance

- **Lazy loading** - Charts initialized only when needed
- **Debounced updates** - Prevents excessive re-renders
- **Efficient polling** - Only fetches data when tracking jobs
- **LocalStorage cleanup** - Removes old tracked jobs automatically

## Accessibility

- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Responsive design for mobile devices
- High contrast colors for readability

## Future Enhancements

Potential additions to the dashboard:

- [ ] Dark mode toggle
- [ ] Customizable refresh intervals
- [ ] Historical metrics graphs
- [ ] Job scheduling interface
- [ ] Real-time WebSocket connection status
- [ ] Filter list library management
- [ ] User authentication for admin features
