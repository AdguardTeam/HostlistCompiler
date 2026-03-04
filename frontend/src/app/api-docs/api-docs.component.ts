/**
 * ApiDocsComponent — API reference page.
 *
 * Displays available endpoints, request/response examples, and
 * live service info from /api/version.
 */

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, JsonPipe } from '@angular/common';
import { API_BASE_URL } from '../tokens';

interface VersionInfo {
    readonly name: string;
    readonly version: string;
    readonly description?: string;
}

interface Endpoint {
    readonly method: 'GET' | 'POST';
    readonly path: string;
    readonly description: string;
    readonly auth?: boolean;
}

@Component({
    selector: 'app-api-docs',
    imports: [
        JsonPipe,
        FormsModule,
        MatCardModule,
        MatIconModule,
        MatChipsModule,
        MatDividerModule,
        MatProgressSpinnerModule,
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
                </mat-card-header>
                <mat-card-content>
                    @for (ep of group.endpoints; track ep.path) {
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

        <!-- Example Request -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>code</mat-icon>
                <mat-card-title>Example: Compile Request</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <pre class="code-block">{{ exampleRequest | json }}</pre>
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
                <mat-option value="/api/compile">POST /api/compile</mat-option>
                <mat-option value="/api/compile/async">POST /compile/async</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Request Body (JSON)</mat-label>
              <textarea matInput rows="10" [value]="requestBodyJson()" (input)="requestBodyJson.set($any($event.target).value)"></textarea>
            </mat-form-field>
            @if (testerResponse()) {
              <pre class="code-block">{{ testerResponse() }}</pre>
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
        padding: 4px 10px; border-radius: 4px; min-width: 48px; text-align: center;
    }
    .method-get { background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent); color: var(--mat-sys-primary); }
    .method-post { background: color-mix(in srgb, var(--mat-sys-tertiary) 15%, transparent); color: var(--mat-sys-tertiary); }
    .endpoint-path { font-size: 14px; font-weight: 600; color: var(--mat-sys-primary); white-space: nowrap; }
    .endpoint-desc { flex: 1; color: var(--mat-sys-on-surface-variant); font-size: 14px; }
    .code-block {
        background: var(--mat-sys-surface-variant); padding: 16px; border-radius: 8px;
        font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto;
    }
    .full-width { width: 100%; }
  `],
})
export class ApiDocsComponent {
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly http = inject(HttpClient);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Item 7: httpResource() — Angular 21 signal-native HTTP primitive.
     * Replaces rxResource + HttpClient. Automatically manages loading/error/value
     * as signals. No manual catchError/subscribe needed.
     */
    readonly versionResource = httpResource<VersionInfo>(() => `${this.apiBaseUrl}/version`);

    readonly endpointGroups: { title: string; icon: string; endpoints: Endpoint[] }[] = [
        {
            title: 'Compilation',
            icon: 'build',
            endpoints: [
                { method: 'POST' as const, path: '/api/compile', description: 'Compile filter lists (JSON response)' },
                { method: 'POST' as const, path: '/compile/stream', description: 'Compile with SSE streaming progress' },
                { method: 'POST' as const, path: '/compile/async', description: 'Queue async compilation job' },
                { method: 'POST' as const, path: '/compile/batch/async', description: 'Queue batch compilation' },
                { method: 'POST' as const, path: '/compile/batch', description: 'Compile multiple filter lists in a single request' },
                { method: 'POST' as const, path: '/ast/parse', description: 'Parse and validate AGTree filter rules' },
            ],
        },
        {
            title: 'Monitoring',
            icon: 'monitoring',
            endpoints: [
                { method: 'GET' as const, path: '/api/health', description: 'Health check — status, version, uptime' },
                { method: 'GET' as const, path: '/api/version', description: 'Service version info' },
                { method: 'GET' as const, path: '/metrics', description: 'Request metrics and latency data' },
            ],
        },
        {
            title: 'Queue Management',
            icon: 'queue',
            endpoints: [
                { method: 'GET' as const, path: '/queue/stats', description: 'Queue depth and job stats' },
                { method: 'GET' as const, path: '/queue/history', description: 'Recent job completion history' },
                { method: 'GET' as const, path: '/queue/results/:requestId', description: 'Fetch results for a completed async job' },
                { method: 'POST' as const, path: '/queue/cancel/:requestId', description: 'Cancel a pending async job' },
            ],
        },
        {
            title: 'Workflow',
            icon: 'account_tree',
            endpoints: [
                { method: 'POST' as const, path: '/workflow/compile', description: 'Cloudflare Workflow-based compilation (durable)' },
                { method: 'POST' as const, path: '/workflow/batch', description: 'Cloudflare Workflow-based batch compilation (durable)' },
            ],
        },
        {
            title: 'Validation',
            icon: 'check_circle',
            endpoints: [
                { method: 'POST' as const, path: '/api/validate', description: 'Validate filter rules via AGTree parser' },
            ],
        },
        {
            title: 'Admin (requires X-Admin-Key)',
            icon: 'admin_panel_settings',
            endpoints: [
                { method: 'GET' as const, path: '/admin/storage/stats', description: 'Storage statistics', auth: true },
                { method: 'GET' as const, path: '/admin/storage/tables', description: 'List D1 tables', auth: true },
                { method: 'POST' as const, path: '/admin/storage/query', description: 'Execute read-only SQL', auth: true },
                { method: 'POST' as const, path: '/admin/storage/clear-cache', description: 'Purge compilation cache', auth: true },
                { method: 'POST' as const, path: '/admin/storage/vacuum', description: 'Vacuum D1 database', auth: true },
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

    readonly selectedEndpoint = signal('/api/compile');
    readonly requestBodyJson = signal(JSON.stringify(this.exampleRequest, null, 2));
    readonly testerResponse = signal<string | null>(null);
    readonly testerLoading = signal(false);

    sendTestRequest(): void {
        this.testerLoading.set(true);
        this.testerResponse.set(null);
        const path = this.selectedEndpoint().replace(/^\/api/, '');
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
