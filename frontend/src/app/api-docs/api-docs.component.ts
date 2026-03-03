/**
 * ApiDocsComponent — API reference page.
 *
 * Displays available endpoints, request/response examples, and
 * live service info from /api/version.
 */

import { Component, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { JsonPipe } from '@angular/common';
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
        MatCardModule,
        MatIconModule,
        MatChipsModule,
        MatDividerModule,
        MatProgressSpinnerModule,
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
  `],
})
export class ApiDocsComponent {
    private readonly apiBaseUrl = inject(API_BASE_URL);

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
            ],
        },
        {
            title: 'Monitoring',
            icon: 'monitoring',
            endpoints: [
                { method: 'GET' as const, path: '/api/health', description: 'Health check — status, version, uptime' },
                { method: 'GET' as const, path: '/api/version', description: 'Service version info' },
                { method: 'GET' as const, path: '/metrics', description: 'Request metrics and latency data' },
                { method: 'GET' as const, path: '/queue/stats', description: 'Queue depth and job stats' },
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
}
