/**
 * HomeComponent — Full-featured dashboard.
 *
 * Restored sections (matching pre-migration functionality):
 *   1. System status bar with health check
 *   2. Live stats grid (5 cards including queue depth)
 *   3. Queue chart (SVG line chart via QueueChartComponent)
 *   4. Quick actions (compile, batch, async)
 *   5. Navigation grid (tools + pages)
 *   6. Endpoint comparison table
 *   7. Interactive API tester (via ApiTesterComponent)
 *   8. Notification settings toggle
 *   9. Auto-refresh toggle with configurable interval
 *
 * Angular 21 patterns: signal(), computed(), inject(), @defer, @if/@for,
 *   model(), DestroyRef, zoneless change detection.
 */

import { Component, computed, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { StatCardComponent } from '../stat-card/stat-card.component';
import { SkeletonCardComponent } from '../skeleton/skeleton-card.component';
import { QueueChartComponent } from '../queue-chart/queue-chart.component';
import { ApiTesterComponent } from '../api-tester/api-tester.component';
import { MetricsStore } from '../store/metrics.store';
import { NotificationService } from '../services/notification.service';
import { LogService } from '../services/log.service';

/** Navigation card for the dashboard grid */
interface NavCard {
    readonly path: string;
    readonly icon: string;
    readonly title: string;
    readonly description: string;
    readonly tag: string;
    readonly tagColor: 'primary' | 'accent' | 'warn';
}

/** Endpoint comparison entry */
interface EndpointInfo {
    readonly method: 'GET' | 'POST';
    readonly path: string;
    readonly description: string;
    readonly mode: string;
}

@Component({
    selector: 'app-home',
    imports: [
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatSlideToggleModule,
        MatTooltipModule,
        StatCardComponent,
        SkeletonCardComponent,
        QueueChartComponent,
        ApiTesterComponent,
    ],
    template: `
    <div class="page-content">
        <!-- ─── Header ─── -->
        <div class="dashboard-header">
            <div>
                <h1 class="mat-headline-4">Adblock Compiler Dashboard</h1>
                <p class="mat-body-1 subtitle">
                    Manage, compile, and monitor adblock filter lists.
                </p>
            </div>
            <div class="header-actions">
                <button mat-stroked-button (click)="store.refresh()"
                    [disabled]="store.isLoading()"
                    matTooltip="Refresh all data">
                    <mat-icon aria-hidden="true">refresh</mat-icon>
                    @if (store.isLoading()) { Refreshing… } @else { Refresh }
                </button>
            </div>
        </div>

        <!-- ─── System Status Bar ─── -->
        <mat-card appearance="outlined" class="status-bar">
            <mat-card-content class="status-bar-content">
                <div class="status-indicator">
                    <mat-icon [style.color]="healthColor()" aria-hidden="true">{{ healthIcon() }}</mat-icon>
                    @if (store.isHealthRevalidating() && !store.health()) {
                        <span class="mat-body-2">Checking API status…</span>
                    } @else if (store.health(); as h) {
                        <span class="mat-body-2">
                            {{ h.status === 'healthy' ? 'All systems operational' : 'Degraded performance' }}
                            — v{{ h.version }}
                        </span>
                    } @else {
                        <span class="mat-body-2" style="color: var(--app-error)">Unable to reach API</span>
                    }
                </div>
                <div class="status-chips">
                    <mat-chip-set>
                        <mat-chip highlighted>Angular 21</mat-chip>
                        <mat-chip>Material Design 3</mat-chip>
                        <mat-chip>Zoneless</mat-chip>
                        <mat-chip>Cloudflare Workers</mat-chip>
                    </mat-chip-set>
                </div>
            </mat-card-content>
        </mat-card>

        <!-- ─── Settings Bar (auto-refresh + notifications) ─── -->
        <div class="settings-bar">
            <div class="setting-item">
                <mat-slide-toggle [(ngModel)]="autoRefreshEnabled"
                    (ngModelChange)="onAutoRefreshToggle($event)">
                    Auto-refresh ({{ autoRefreshInterval / 1000 }}s)
                </mat-slide-toggle>
            </div>
            <div class="setting-item">
                <mat-slide-toggle [ngModel]="notifications.isEnabled()"
                    (ngModelChange)="notifications.toggleNotifications()">
                    Browser notifications
                </mat-slide-toggle>
            </div>
            @if (store.isStale()) {
                <span class="stale-indicator mat-body-2">
                    <mat-icon class="inline-icon" aria-hidden="true">schedule</mat-icon> Data may be stale
                </span>
            }
        </div>

        <!-- ─── Live Stats Grid (5 cards) ─── -->
        @if (store.isLoading() && !store.metrics()) {
            <div class="stats-grid">
                @for (i of [0,1,2,3,4]; track i) {
                    <app-skeleton-card [lines]="2" [lineWidths]="['60%', '40%']" />
                }
            </div>
        } @else {
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
        }

        <!-- ─── Queue Chart ─── -->
        @defer (on viewport) {
            <mat-card appearance="outlined" class="section-card">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">show_chart</mat-icon>
                    <mat-card-title>Queue Depth Over Time</mat-card-title>
                    <mat-card-subtitle>
                        Processing rate: {{ queueProcessingRate() }} jobs/sec
                    </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <app-queue-chart
                        [dataPoints]="queueDepthHistory()"
                        label="Queue Depth"
                        color="var(--app-primary)"
                        [height]="200" />
                </mat-card-content>
                <mat-card-actions>
                    <button mat-button (click)="store.refreshQueue()">
                        <mat-icon aria-hidden="true">refresh</mat-icon> Refresh Queue
                    </button>
                </mat-card-actions>
            </mat-card>
        } @placeholder (minimum 200ms) {
            <app-skeleton-card [lines]="4" [lineWidths]="['100%','90%','80%','70%']" />
        }

        <!-- ─── Quick Actions ─── -->
        <h2 class="mat-headline-6 section-title">Quick Actions</h2>
        <div class="quick-actions">
            <button mat-raised-button color="primary" (click)="navigateTo('/compiler')">
                <mat-icon aria-hidden="true">build</mat-icon> Compile Filter List
            </button>
            <button mat-stroked-button (click)="navigateTo('/compiler')" matTooltip="Send batch compilation">
                <mat-icon aria-hidden="true">dynamic_feed</mat-icon> Batch Compile
            </button>
            <button mat-stroked-button (click)="navigateTo('/compiler')" matTooltip="Queue async compilation">
                <mat-icon aria-hidden="true">schedule_send</mat-icon> Async Compile
            </button>
            <button mat-stroked-button (click)="showTester.set(true)" matTooltip="Test API endpoints">
                <mat-icon aria-hidden="true">science</mat-icon> API Tester
            </button>
        </div>

        <!-- ─── API Tester (deferred) ─── -->
        @defer (when showTester()) {
            <app-api-tester [(collapsed)]="testerCollapsed" />
        }

        <!-- ─── Navigation Grid ─── -->
        <h2 class="mat-headline-6 section-title">Tools &amp; Pages</h2>
        <div class="nav-grid">
            @for (card of navCards; track card.path) {
                @defer (on viewport; prefetch on hover) {
                    <mat-card appearance="outlined" class="nav-card" (click)="navigateTo(card.path)">
                        <mat-card-header>
                            <mat-icon mat-card-avatar [style.color]="'var(--mat-sys-primary)'" aria-hidden="true">{{ card.icon }}</mat-icon>
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
                } @placeholder {
                    <app-skeleton-card [showAvatar]="true" [lines]="2" [lineWidths]="['80%', '60%']" />
                }
            }
        </div>

        <mat-divider class="mb-3 mt-3"></mat-divider>

        <!-- ─── Endpoint Comparison ─── -->
        @defer (on viewport) {
            <mat-card appearance="outlined" class="section-card">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">compare_arrows</mat-icon>
                    <mat-card-title>API Endpoint Comparison</mat-card-title>
                    <mat-card-subtitle>All available compilation and monitoring endpoints</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="endpoint-list">
                        @for (ep of endpointComparison; track ep.path) {
                            <div class="endpoint-row">
                                <span class="endpoint-method" [class]="ep.method === 'POST' ? 'method-post' : 'method-get'">
                                    {{ ep.method }}
                                </span>
                                <code class="endpoint-path">{{ ep.path }}</code>
                                <span class="endpoint-desc mat-body-2">{{ ep.description }}</span>
                                <mat-chip class="endpoint-mode">{{ ep.mode }}</mat-chip>
                            </div>
                        }
                    </div>
                </mat-card-content>
            </mat-card>
        } @placeholder (minimum 200ms) {
            <app-skeleton-card [lines]="6" [lineWidths]="['100%','95%','90%','85%','80%','75%']" />
        }
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 16px;
    }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 0; }
    .section-title { margin: 24px 0 16px; }

    /* Status bar */
    .status-bar { margin-bottom: 16px; }
    .status-bar-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
    }
    .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Settings bar */
    .settings-bar {
        display: flex;
        align-items: center;
        gap: 24px;
        flex-wrap: wrap;
        margin-bottom: 20px;
        padding: 8px 0;
    }
    .stale-indicator {
        color: var(--app-warning, #ff9800);
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .inline-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Stats grid */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    /* Quick actions */
    .quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 24px;
    }

    /* Navigation grid */
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

    /* Section cards */
    .section-card { margin-bottom: 24px; }

    /* Endpoint comparison */
    .endpoint-list { display: flex; flex-direction: column; gap: 8px; }
    .endpoint-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--app-surface-variant, #f5f5f5);
        flex-wrap: wrap;
    }
    .endpoint-method {
        font-weight: 700;
        font-size: 0.75rem;
        min-width: 48px;
        text-align: center;
        padding: 2px 8px;
        border-radius: 4px;
    }
    .method-get { background: var(--app-success, #4caf50); color: #fff; }
    .method-post { background: var(--app-primary, #6750a4); color: #fff; }
    .endpoint-path {
        font-family: monospace;
        font-size: 0.875rem;
        white-space: nowrap;
    }
    .endpoint-desc { flex: 1; color: var(--mat-sys-on-surface-variant); }
    .endpoint-mode { font-size: 0.75rem; }

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
            description: 'Compile and transform adblock filter lists with real-time SSE streaming, batch, and async modes.',
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
            description: 'Full HTTP API reference including async, batch, streaming, and queue endpoints.',
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

    /** Endpoint comparison data for the reference table */
    readonly endpointComparison: EndpointInfo[] = [
        { method: 'POST', path: '/compile',            description: 'Synchronous compilation — returns JSON result',           mode: 'Sync' },
        { method: 'POST', path: '/compile/stream',     description: 'SSE streaming compilation with real-time progress',       mode: 'Stream' },
        { method: 'POST', path: '/compile/batch',      description: 'Batch compile multiple configurations in one request',    mode: 'Batch' },
        { method: 'POST', path: '/compile/async',      description: 'Queue compilation for background processing',            mode: 'Async' },
        { method: 'POST', path: '/compile/batch/async', description: 'Queue batch compilation for background processing',     mode: 'Batch+Async' },
        { method: 'POST', path: '/ast/parse',          description: 'Parse adblock rules into AST representation',            mode: 'Sync' },
        { method: 'GET',  path: '/metrics',            description: 'Performance metrics, latency percentiles, hit rates',    mode: 'Monitoring' },
        { method: 'GET',  path: '/queue/stats',        description: 'Queue depth, job counts, processing rate, history',      mode: 'Monitoring' },
        { method: 'GET',  path: '/queue/results/:id',  description: 'Retrieve results for a queued async job',                mode: 'Async' },
    ];

    readonly highlightedCard = signal(false);
    readonly showTester = signal(false);
    readonly testerCollapsed = signal(true);

    /** Auto-refresh state */
    autoRefreshEnabled = false;
    autoRefreshInterval = 30_000;
    private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

    readonly store = inject(MetricsStore);
    readonly notifications = inject(NotificationService);
    private readonly log = inject(LogService);
    private readonly liveAnnouncer = inject(LiveAnnouncer);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private readonly platformId = inject(PLATFORM_ID);

    constructor() {
        this.destroyRef.onDestroy(() => this.stopAutoRefresh());
    }

    /** Derive stat cards from store metrics + queue stats (5 cards) */
    readonly liveStats = computed(() => {
        const m = this.store.metrics();
        const q = this.store.queueStats();
        return [
            { label: 'Total Requests',    value: m ? m.totalRequests.toLocaleString() : '--',       icon: 'api',           color: 'var(--mat-sys-primary)' },
            { label: 'Avg Response Time', value: m ? `${Math.round(m.averageDuration)}ms` : '--ms', icon: 'timer',         color: 'var(--mat-sys-tertiary)' },
            { label: 'Cache Hit Rate',    value: m ? `${m.cacheHitRate}%` : '--%',                  icon: 'cached',        color: 'var(--mat-sys-secondary)' },
            { label: 'Success Rate',      value: m ? `${m.successRate}%` : '--%',                   icon: 'check_circle',  color: 'var(--mat-sys-primary)' },
            { label: 'Queue Depth',       value: q ? q.currentDepth.toString() : '--',              icon: 'queue',         color: 'var(--app-warning, #ff9800)' },
        ];
    });

    /** Queue depth history for chart */
    readonly queueDepthHistory = computed(() => {
        const q = this.store.queueStats();
        return q?.depthHistory?.map(h => h.depth) ?? [];
    });

    /** Queue processing rate display */
    readonly queueProcessingRate = computed(() => {
        const q = this.store.queueStats();
        return q?.processingRate?.toFixed(1) ?? '0.0';
    });

    readonly healthColor = computed(() => {
        const h = this.store.health();
        if (!h) return 'var(--mat-sys-on-surface-variant)';
        return h.status === 'healthy' ? 'var(--mat-sys-primary)' : 'var(--mat-sys-error)';
    });

    readonly healthIcon = computed(() => {
        const h = this.store.health();
        if (!h) return 'help_outline';
        return h.status === 'healthy' ? 'check_circle' : 'warning';
    });

    onAutoRefreshToggle(enabled: boolean): void {
        if (enabled) {
            this.startAutoRefresh();
            this.log.info('Auto-refresh enabled', 'dashboard', { interval: this.autoRefreshInterval });
        } else {
            this.stopAutoRefresh();
            this.log.info('Auto-refresh disabled', 'dashboard');
        }
    }

    navigateTo(path: string): void {
        this.router.navigate([path]);
    }

    onStatCardClicked(label: string): void {
        if (label === 'Total Requests' || label === 'Avg Response Time') {
            this.router.navigate(['/performance']);
        } else if (label === 'Queue Depth') {
            this.store.refreshQueue();
        }
    }

    private startAutoRefresh(): void {
        this.stopAutoRefresh();
        if (!isPlatformBrowser(this.platformId)) return;
        this.autoRefreshTimer = setInterval(() => this.store.refresh(), this.autoRefreshInterval);
    }

    private stopAutoRefresh(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
    }
}

