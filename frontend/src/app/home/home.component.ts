/**
 * Angular PoC - Home/Dashboard Component
 *
 * Angular 21 patterns demonstrated:
 *
 * StatCardComponent (input / output / model signal APIs)
 *   The stats grid uses the new <app-stat-card> component, binding inputs with
 *   the signal input() API and two-way [(highlighted)] with model().
 *
 * @defer — stable v17+
 *   Defers loading and rendering of a child component until a trigger fires.
 *   With SSR + RenderMode.Prerender on this route, @defer enables incremental
 *   hydration: the placeholder HTML is sent in the initial payload and the
 *   heavy component is hydrated progressively as it enters the viewport.
 *
 *   Triggers:
 *     on viewport  — defers until the block enters the viewport (IntersectionObserver)
 *     on idle      — defers until requestIdleCallback fires
 *     on interaction — defers on first click / focus
 *     on timer(n)  — defers after n milliseconds
 *     when (expr)  — defers until a signal/boolean becomes truthy
 *
 *   Sub-blocks:
 *     @placeholder  — shown while the dependency chunk is being fetched
 *     @loading      — shown while the async loader is running (minimum 300ms avoids flicker)
 *     @error        — shown if the loader throws
 *
 * viewChild() — stable v17.3+
 *   Typed signal query for a template element or directive reference.
 *   Used here to get the action-card element for programmatic focus management.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatCardComponent } from '../stat-card/stat-card.component';
import { API_BASE_URL } from '../tokens';

/** Navigation card for the dashboard grid */
interface NavCard {
    readonly path: string;
    readonly icon: string;
    readonly title: string;
    readonly description: string;
    readonly tag: string;
    readonly tagColor: 'primary' | 'accent' | 'warn';
}

/** Metrics response from /api/metrics */
interface MetricsResponse {
    readonly totalRequests: number;
    readonly averageDuration: number;
    readonly cacheHitRate: number;
    readonly successRate: number;
}

/** Health response from /api/health */
interface HealthResponse {
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly version: string;
}

/**
 * HomeComponent
 * Dashboard page with @defer, signal inputs via StatCardComponent, and viewChild().
 */
@Component({
    selector: 'app-home',
    standalone: true,
    imports: [
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        StatCardComponent,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">Adblock Compiler Dashboard</h1>
        <p class="mat-body-1 subtitle">
            Manage, compile, and monitor adblock filter lists.
        </p>

        <!-- Live Stats Grid -->
        <div class="stats-grid">
            @for (stat of liveStats(); track stat.label) {
                <app-stat-card
                    [label]="stat.label"
                    [value]="stat.value"
                    [icon]="stat.icon"
                    [color]="stat.color"
                    [(highlighted)]="highlightedCard"
                    (cardClicked)="onStatCardClicked($event)"
                />
            }
        </div>

        <!-- Navigation Grid -->
        <h2 class="mat-headline-6 section-title">Tools</h2>
        <div class="nav-grid">
            @for (card of navCards; track card.path) {
                <mat-card appearance="outlined" class="nav-card" (click)="navigateTo(card.path)">
                    <mat-card-header>
                        <mat-icon mat-card-avatar [style.color]="'var(--mat-sys-primary)'">{{ card.icon }}</mat-icon>
                        <mat-card-title>{{ card.title }}</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                        <p class="mat-body-2 nav-description">{{ card.description }}</p>
                    </mat-card-content>
                    <mat-card-actions>
                        <mat-chip-set>
                            <mat-chip [color]="card.tagColor" highlighted>{{ card.tag }}</mat-chip>
                        </mat-chip-set>
                    </mat-card-actions>
                </mat-card>
            }
        </div>

        <mat-divider class="mb-3 mt-3"></mat-divider>

        <!-- System Status -->
        @defer (on viewport) {
            <mat-card appearance="outlined" class="status-card mt-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar
                        [style.color]="healthColor()">{{ healthIcon() }}</mat-icon>
                    <mat-card-title>System Status</mat-card-title>
                    <mat-card-subtitle>
                        @if (healthResource.isLoading()) {
                            Checking…
                        } @else if (healthResource.value(); as h) {
                            {{ h.status === 'healthy' ? 'All systems operational' : 'Degraded performance' }} — v{{ h.version }}
                        } @else {
                            Unable to reach API
                        }
                    </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <mat-chip-set>
                        <mat-chip highlighted color="primary">Angular 21</mat-chip>
                        <mat-chip>Material Design 3</mat-chip>
                        <mat-chip>SSR</mat-chip>
                        <mat-chip>Zoneless</mat-chip>
                        <mat-chip>Cloudflare Workers</mat-chip>
                    </mat-chip-set>
                </mat-card-content>
            </mat-card>
        } @placeholder (minimum 200ms) {
            <mat-card appearance="outlined" class="status-card mt-2">
                <mat-card-content class="placeholder-content">
                    <mat-spinner diameter="32"></mat-spinner>
                    <span class="mat-body-2">Loading status…</span>
                </mat-card-content>
            </mat-card>
        }
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .section-title { margin: 24px 0 16px; }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }
    .nav-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
    }
    .nav-card {
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .nav-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px var(--mat-sys-shadow, rgba(0,0,0,0.15));
    }
    .nav-description { color: var(--mat-sys-on-surface-variant); margin-top: 8px; }
    .status-card { background-color: var(--mat-sys-surface-variant); }
    .placeholder-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 24px;
    }
  `],
})
export class HomeComponent {
    readonly navCards: NavCard[] = [
        {
            path: '/compiler',
            icon: 'build',
            title: 'Filter List Compiler',
            description: 'Compile and transform adblock filter lists from multiple sources with real-time SSE streaming.',
            tag: 'Core',
            tagColor: 'primary',
        },
        {
            path: '/performance',
            icon: 'monitoring',
            title: 'Performance Metrics',
            description: 'Real-time compilation performance metrics, latency percentiles, and endpoint breakdown.',
            tag: 'Monitoring',
            tagColor: 'accent',
        },
        {
            path: '/validation',
            icon: 'check_circle',
            title: 'Rule Validation',
            description: 'Validate adblock filter rules using the AGTree parser with color-coded error reporting.',
            tag: 'Tools',
            tagColor: 'primary',
        },
        {
            path: '/api-docs',
            icon: 'description',
            title: 'API Documentation',
            description: 'HTTP API reference with endpoint details, request examples, and authentication info.',
            tag: 'Reference',
            tagColor: 'accent',
        },
        {
            path: '/admin',
            icon: 'admin_panel_settings',
            title: 'Storage Admin',
            description: 'Manage KV, R2, and D1 storage. Requires admin authentication.',
            tag: 'Admin',
            tagColor: 'warn',
        },
    ];

    readonly highlightedCard = signal(false);

    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly router = inject(Router);
    private readonly refreshTrigger = signal(0);

    /** Live metrics from /api/metrics */
    readonly metricsResource = rxResource<MetricsResponse, number>({
        params: () => this.refreshTrigger(),
        stream: () => this.http.get<MetricsResponse>(`${this.apiBaseUrl}/metrics`).pipe(
            catchError(() => of({
                totalRequests: 0,
                averageDuration: 0,
                cacheHitRate: 0,
                successRate: 0,
            } as MetricsResponse)),
        ),
    });

    /** Live health from /api/health */
    readonly healthResource = rxResource<HealthResponse, number>({
        params: () => this.refreshTrigger(),
        stream: () => this.http.get<HealthResponse>(`${this.apiBaseUrl}/health`).pipe(
            catchError(() => of({ status: 'unhealthy' as const, version: 'unknown' })),
        ),
    });

    /** Derive stat cards from live metrics */
    readonly liveStats = computed(() => {
        const m = this.metricsResource.value();
        return [
            { label: 'Total Requests',      value: m ? m.totalRequests.toLocaleString() : '--',  icon: 'api',       color: 'var(--mat-sys-primary)'   },
            { label: 'Avg Response Time',   value: m ? `${Math.round(m.averageDuration)}ms` : '--ms', icon: 'timer', color: 'var(--mat-sys-tertiary)' },
            { label: 'Cache Hit Rate',      value: m ? `${m.cacheHitRate}%` : '--%',             icon: 'cached',    color: 'var(--mat-sys-secondary)' },
            { label: 'Success Rate',        value: m ? `${m.successRate}%` : '--%',              icon: 'check_circle', color: 'var(--mat-sys-primary)' },
        ];
    });

    readonly healthColor = computed(() => {
        const h = this.healthResource.value();
        if (!h) return 'var(--mat-sys-on-surface-variant)';
        return h.status === 'healthy' ? 'var(--mat-sys-primary)' : 'var(--mat-sys-error)';
    });

    readonly healthIcon = computed(() => {
        const h = this.healthResource.value();
        if (!h) return 'help_outline';
        return h.status === 'healthy' ? 'check_circle' : 'warning';
    });

    navigateTo(path: string): void {
        this.router.navigate([path]);
    }

    onStatCardClicked(label: string): void {
        if (label === 'Total Requests' || label === 'Avg Response Time') {
            this.router.navigate(['/performance']);
        }
    }
}

