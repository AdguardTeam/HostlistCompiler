/**
 * ApiDocsComponent — API reference page.
 *
 * Displays available endpoints, request/response examples, and
 * live service info from /api/version. Code samples use inline JSON
 * syntax highlighting via highlightJson() / highlightJsonString().
 */

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { API_BASE_URL } from '../tokens';

interface VersionInfo {
    readonly name: string;
    readonly version: string;
    readonly description?: string;
}

interface Endpoint {
    readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    readonly path: string;
    readonly description: string;
    readonly auth?: boolean;
}

@Component({
    selector: 'app-api-docs',
    imports: [
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatChipsModule,
        MatDividerModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">API Reference</h1>
        <p class="subtitle mat-body-1">Adblock Compiler HTTP API endpoints</p>

        <!-- Service Info -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>info</mat-icon>
                <mat-card-title>Service Info</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                @if (versionResource.isLoading()) {
                    <mat-progress-spinner diameter="24" mode="indeterminate" />
                } @else if (versionResource.value(); as v) {
                    <mat-chip-set>
                        <mat-chip highlighted color="primary">{{ v.name }}</mat-chip>
                        <mat-chip>v{{ v.version }}</mat-chip>
                    </mat-chip-set>
                } @else {
                    <span class="mat-body-2">Unable to reach API</span>
                }
            </mat-card-content>
        </mat-card>

        <!-- Endpoint Groups -->
        @for (group of endpointGroups; track group.title) {
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar>{{ group.icon }}</mat-icon>
                    <mat-card-title>{{ group.title }}</mat-card-title>
                    @if (group.description) {
                        <mat-card-subtitle>{{ group.description }}</mat-card-subtitle>
                    }
                </mat-card-header>
                <mat-card-content>
                    @for (ep of group.endpoints; track ep.path + ep.method) {
                        <div class="endpoint-row">
                            <span class="method-badge" [class]="'method-' + ep.method.toLowerCase()">
                                {{ ep.method }}
                            </span>
                            <code class="endpoint-path">{{ ep.path }}</code>
                            <span class="endpoint-desc">{{ ep.description }}</span>
                            @if (ep.auth) {
                                <mat-chip color="warn" highlighted>Auth</mat-chip>
                            }
                        </div>
                    }
                </mat-card-content>
            </mat-card>
        }

        <!-- Example: Compile Request -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>code</mat-icon>
                <mat-card-title>Example: POST /compile</mat-card-title>
                <mat-card-subtitle>Compile one or more remote filter lists into a single output</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <pre class="code-block" [innerHTML]="highlightJson(exampleRequest)"></pre>
            </mat-card-content>
        </mat-card>

        <!-- Example: Validate Request -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>check_circle</mat-icon>
                <mat-card-title>Example: POST /validate</mat-card-title>
                <mat-card-subtitle>Validate raw filter rules via the AGTree parser</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <pre class="code-block" [innerHTML]="highlightJson(exampleValidateRequest)"></pre>
            </mat-card-content>
        </mat-card>

        <!-- Example: Validate Single Rule -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>rule</mat-icon>
                <mat-card-title>Example: POST /validate-rule</mat-card-title>
                <mat-card-subtitle>Validate a single filter rule and get detailed parse information</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <pre class="code-block" [innerHTML]="highlightJson(exampleValidateRuleRequest)"></pre>
            </mat-card-content>
        </mat-card>

        <!-- Example: WebSocket -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>swap_horiz</mat-icon>
                <mat-card-title>Example: GET /ws/compile (WebSocket)</mat-card-title>
                <mat-card-subtitle>Real-time streaming compilation via WebSocket</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <pre class="code-block" [innerHTML]="highlightJson(exampleWebSocketUsage)"></pre>
            </mat-card-content>
        </mat-card>

        <!-- API Tester -->
        <mat-card appearance="outlined" class="mb-2">
          <mat-card-header>
            <mat-icon mat-card-avatar>play_circle</mat-icon>
            <mat-card-title>Try It</mat-card-title>
            <mat-card-subtitle>Send a live request to the API</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Endpoint</mat-label>
              <mat-select [value]="selectedEndpoint()" (selectionChange)="selectedEndpoint.set($event.value)">
                <mat-option value="/compile">POST /compile</mat-option>
                <mat-option value="/compile/async">POST /compile/async</mat-option>
                <mat-option value="/validate">POST /validate</mat-option>
                <mat-option value="/validate-rule">POST /validate-rule</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Request Body (JSON)</mat-label>
              <textarea matInput rows="10" [value]="requestBodyJson()" (input)="requestBodyJson.set($any($event.target).value)"></textarea>
            </mat-form-field>
            @if (testerResponse()) {
              <pre class="code-block" [innerHTML]="highlightJsonString(testerResponse()!)"></pre>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-raised-button color="primary" (click)="sendTestRequest()" [disabled]="testerLoading()">
              @if (testerLoading()) { <mat-progress-spinner diameter="16" mode="indeterminate" /> }
              @else { <mat-icon>send</mat-icon> }
              Send Request
            </button>
          </mat-card-actions>
        </mat-card>
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .endpoint-row {
        display: flex; align-items: center; gap: 12px;
        padding: 12px; border-radius: 8px; margin-bottom: 8px;
        border: 1px solid var(--mat-sys-outline-variant);
    }
    .method-badge {
        font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700;
        padding: 4px 10px; border-radius: 4px; min-width: 56px; text-align: center;
    }
    .method-get    { background: color-mix(in srgb, #4a90d9 15%, transparent); color: #4a90d9; }
    .method-post   { background: color-mix(in srgb, #49a55d 15%, transparent); color: #49a55d; }
    .method-put    { background: color-mix(in srgb, #e8a838 15%, transparent); color: #e8a838; }
    .method-delete { background: color-mix(in srgb, #d9534f 15%, transparent); color: #d9534f; }
    .endpoint-path { font-size: 14px; font-weight: 600; color: var(--mat-sys-primary); white-space: nowrap; }
    .endpoint-desc { flex: 1; color: var(--mat-sys-on-surface-variant); font-size: 14px; }
    .code-block {
        background: #1e1e2e; color: #cdd6f4;
        padding: 20px; border-radius: 8px;
        font-family: 'Courier New', Consolas, monospace; font-size: 13px;
        line-height: 1.6; overflow-x: auto; margin: 0;
    }
    /* JSON syntax token colours */
    .code-block ::ng-deep .json-key     { color: #89b4fa; }
    .code-block ::ng-deep .json-string  { color: #a6e3a1; }
    .code-block ::ng-deep .json-number  { color: #fab387; }
    .code-block ::ng-deep .json-boolean { color: #cba6f7; }
    .code-block ::ng-deep .json-null    { color: #f38ba8; }
    .full-width { width: 100%; }
  `],
})
export class ApiDocsComponent {
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly http = inject(HttpClient);
    private readonly destroyRef = inject(DestroyRef);
    private readonly sanitizer = inject(DomSanitizer);

    /**
     * Item 7: httpResource() — Angular 21 signal-native HTTP primitive.
     * Replaces rxResource + HttpClient. Automatically manages loading/error/value
     * as signals. No manual catchError/subscribe needed.
     */
    readonly versionResource = httpResource<VersionInfo>(() => `${this.apiBaseUrl}/version`);

    readonly endpointGroups: { title: string; icon: string; description?: string; endpoints: Endpoint[] }[] = [
        {
            title: 'Compilation',
            icon: 'build',
            description: 'Compile remote or inline filter lists into a merged output',
            endpoints: [
                { method: 'POST', path: '/compile', description: 'Compile filter lists (JSON response)' },
                { method: 'POST', path: '/compile/stream', description: 'Compile with SSE streaming progress' },
                { method: 'POST', path: '/compile/async', description: 'Queue async compilation job' },
                { method: 'POST', path: '/compile/batch', description: 'Compile multiple filter lists in a single request' },
                { method: 'POST', path: '/compile/batch/async', description: 'Queue batch compilation' },
                { method: 'POST', path: '/ast/parse', description: 'Parse and validate AGTree filter rules' },
                { method: 'GET',  path: '/ws/compile', description: 'WebSocket endpoint — real-time streaming compilation (upgrade required)' },
            ],
        },
        {
            title: 'Validation',
            icon: 'check_circle',
            description: 'Validate filter rules and individual rule syntax',
            endpoints: [
                { method: 'POST', path: '/validate', description: 'Validate a list of filter rules via the AGTree parser' },
                { method: 'POST', path: '/validate-rule', description: 'Validate a single filter rule and return detailed parse information' },
            ],
        },
        {
            title: 'Rule Sets',
            icon: 'list_alt',
            description: 'CRUD operations for persisted rule-set definitions (requires auth)',
            endpoints: [
                { method: 'GET',    path: '/rules',      description: 'List all rule sets', auth: true },
                { method: 'POST',   path: '/rules',      description: 'Create a new rule set', auth: true },
                { method: 'GET',    path: '/rules/:id',  description: 'Get a specific rule set by ID', auth: true },
                { method: 'PUT',    path: '/rules/:id',  description: 'Update a rule set by ID', auth: true },
                { method: 'DELETE', path: '/rules/:id',  description: 'Delete a rule set by ID', auth: true },
            ],
        },
        {
            title: 'Monitoring',
            icon: 'monitoring',
            description: 'Health checks, metrics, and deployment history',
            endpoints: [
                { method: 'GET', path: '/health', description: 'Basic health check — liveness probe' },
                { method: 'GET', path: '/health/latest', description: 'Detailed health status — version, uptime, component checks' },
                { method: 'GET', path: '/version', description: 'Service version info' },
                { method: 'GET', path: '/metrics', description: 'Request metrics and latency data' },
                { method: 'GET', path: '/deployments', description: 'Deployment history log' },
                { method: 'GET', path: '/deployments/stats', description: 'Aggregated deployment statistics' },
            ],
        },
        {
            title: 'Queue Management',
            icon: 'queue',
            description: 'Manage asynchronous compilation jobs',
            endpoints: [
                { method: 'GET',  path: '/queue/stats', description: 'Queue depth and job stats' },
                { method: 'GET',  path: '/queue/history', description: 'Recent job completion history' },
                { method: 'GET',  path: '/queue/results/:requestId', description: 'Fetch results for a completed async job' },
                { method: 'POST', path: '/queue/cancel/:requestId', description: 'Cancel a pending async job' },
            ],
        },
        {
            title: 'Workflow',
            icon: 'account_tree',
            description: 'Durable Cloudflare Workflow-based operations with status tracking',
            endpoints: [
                { method: 'POST', path: '/workflow/compile',              description: 'Cloudflare Workflow-based compilation (durable, survives restarts)' },
                { method: 'POST', path: '/workflow/batch',                description: 'Cloudflare Workflow-based batch compilation (durable)' },
                { method: 'POST', path: '/workflow/cache-warm',           description: 'Trigger a cache-warming workflow run' },
                { method: 'POST', path: '/workflow/health-check',         description: 'Trigger a health-monitoring workflow run' },
                { method: 'GET',  path: '/workflow/metrics',              description: 'Workflow execution metrics and throughput stats' },
                { method: 'GET',  path: '/workflow/status/:type/:id',     description: 'Poll status of a specific workflow instance' },
                { method: 'GET',  path: '/workflow/events/:workflowId',   description: 'Stream real-time workflow events (SSE)' },
            ],
        },
        {
            title: 'Admin (requires X-Admin-Key)',
            icon: 'admin_panel_settings',
            description: 'Storage inspection, cache management, and data export',
            endpoints: [
                { method: 'GET',  path: '/admin/storage/stats',         description: 'Storage statistics', auth: true },
                { method: 'GET',  path: '/admin/storage/tables',        description: 'List D1 tables', auth: true },
                { method: 'POST', path: '/admin/storage/query',         description: 'Execute read-only SQL', auth: true },
                { method: 'POST', path: '/admin/storage/clear-cache',   description: 'Purge compilation cache', auth: true },
                { method: 'POST', path: '/admin/storage/vacuum',        description: 'Vacuum D1 database', auth: true },
                { method: 'POST', path: '/admin/storage/clear-expired', description: 'Remove expired cache entries', auth: true },
                { method: 'GET',  path: '/admin/storage/export',        description: 'Export storage data as JSON', auth: true },
            ],
        },
    ];

    readonly exampleRequest = {
        configuration: {
            name: 'My Filter List',
            sources: [{ source: 'https://easylist.to/easylist/easylist.txt' }],
            transformations: ['RemoveComments', 'Deduplicate', 'TrimLines'],
        },
        benchmark: true,
    };

    readonly exampleValidateRequest = {
        rules: [
            '||example.com^',
            '@@||example.com/allowed^',
            '##.ad-banner',
        ],
    };

    readonly exampleValidateRuleRequest = {
        rule: '||ads.example.com^$third-party',
    };

    readonly exampleWebSocketUsage = {
        description: 'Upgrade an HTTP request to a WebSocket connection at /ws/compile, then send a compile payload as JSON text. The server streams progress events and the final compiled output.',
        example: "const ws = new WebSocket('wss://adblock-compiler.jayson-knight.workers.dev/ws/compile');\nws.onopen = () => ws.send(JSON.stringify({ configuration: { sources: [...] } }));\nws.onmessage = ({ data }) => console.log(JSON.parse(data));",
    };

    readonly selectedEndpoint = signal('/compile');
    readonly requestBodyJson = signal(JSON.stringify(this.exampleRequest, null, 2));
    readonly testerResponse = signal<string | null>(null);
    readonly testerLoading = signal(false);

    /** Returns syntax-highlighted HTML for any JSON-serialisable value. */
    highlightJson(value: unknown): SafeHtml {
        return this.highlightJsonString(JSON.stringify(value, null, 2));
    }

    /** Returns syntax-highlighted HTML for a raw JSON string. */
    highlightJsonString(json: string): SafeHtml {
        const escaped = json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const highlighted = escaped.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?)/g,
            (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'json-key' : 'json-string';
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            },
        );
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }

    sendTestRequest(): void {
        this.testerLoading.set(true);
        this.testerResponse.set(null);
        const path = this.selectedEndpoint();
        const url = `${this.apiBaseUrl}${path}`;
        let body: unknown;
        try {
            body = JSON.parse(this.requestBodyJson());
        } catch (e) {
            this.testerResponse.set(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
            this.testerLoading.set(false);
            return;
        }
        this.http.post(url, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (res) => {
                this.testerResponse.set(JSON.stringify(res, null, 2));
                this.testerLoading.set(false);
            },
            error: (err) => {
                this.testerResponse.set(`Error: ${err instanceof Error ? err.message : String(err)}`);
                this.testerLoading.set(false);
            },
        });
    }
}
