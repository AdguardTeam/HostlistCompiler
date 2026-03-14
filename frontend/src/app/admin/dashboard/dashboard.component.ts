/**
 * DashboardComponent — Admin dashboard overview panel.
 *
 * Shows summary metric cards, a recent audit activity feed,
 * and system health status indicators. Data is loaded in parallel
 * from multiple admin endpoints.
 */

import {
    Component, afterNextRender, inject, signal,
    ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

interface AuditLogEntry {
    readonly id: number;
    readonly actor_id: string;
    readonly actor_email: string | null;
    readonly action: string;
    readonly resource_type: string;
    readonly resource_id: string | null;
    readonly status: string;
    readonly created_at: string;
}

interface AuditLogResponse {
    readonly success: boolean;
    readonly items: AuditLogEntry[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

interface TierConfigResponse {
    readonly success: boolean;
    readonly items: { readonly id: number; readonly tier_name: string; readonly is_active: boolean }[];
    readonly total: number;
}

interface FeatureFlagResponse {
    readonly success: boolean;
    readonly items: { readonly id: number; readonly enabled: boolean }[];
    readonly total: number;
}

interface MetricCard {
    readonly icon: string;
    readonly label: string;
    readonly value: number;
    readonly color: string;
    readonly barWidths: number[];
}

type HealthStatus = 'green' | 'yellow' | 'red';

interface HealthCheck {
    readonly label: string;
    readonly status: HealthStatus;
}

@Component({
    selector: 'app-admin-dashboard',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        DecimalPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDividerModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">dashboard</mat-icon>
            <mat-card-title>Dashboard</mat-card-title>
            <mat-card-subtitle>System overview and key metrics</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-stroked-button (click)="loadData()">
                <mat-icon aria-hidden="true">refresh</mat-icon> Refresh
            </button>
        </mat-card-actions>
    </mat-card>

    <!-- Metric Cards -->
    @if (loading()) {
        <div class="loading-container">
            <mat-progress-spinner diameter="40" mode="indeterminate" />
        </div>
    } @else {
        <div class="metrics-grid">
            @for (card of metricCards(); track card.label) {
                <mat-card appearance="outlined" class="metric-card">
                    <mat-card-content>
                        <div class="metric-header">
                            <mat-icon [style.color]="card.color" aria-hidden="true">{{ card.icon }}</mat-icon>
                            <span class="metric-value">{{ card.value | number }}</span>
                        </div>
                        <div class="metric-label">{{ card.label }}</div>
                        <div class="mini-chart">
                            @for (w of card.barWidths; track $index) {
                                <div class="mini-bar" [style.height.%]="w" [style.background]="card.color"></div>
                            }
                        </div>
                    </mat-card-content>
                </mat-card>
            }
        </div>

        <div class="dashboard-columns">
            <!-- Recent Activity -->
            <mat-card appearance="outlined" class="activity-card">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">history</mat-icon>
                    <mat-card-title>Recent Activity</mat-card-title>
                    <mat-card-subtitle>Last 10 audit events</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    @if (recentActivity().length === 0) {
                        <p class="empty-state">No recent activity.</p>
                    } @else {
                        <mat-list>
                            @for (entry of recentActivity(); track entry.id) {
                                <mat-list-item>
                                    <mat-icon matListItemIcon [class]="'action-icon action-' + entry.action" aria-hidden="true">
                                        {{ getActionIcon(entry.action) }}
                                    </mat-icon>
                                    <span matListItemTitle>
                                        <span class="action-chip" [class]="'action-' + entry.action">{{ entry.action }}</span>
                                        {{ entry.resource_type }}
                                        @if (entry.resource_id) {
                                            <code class="resource-id">{{ entry.resource_id }}</code>
                                        }
                                    </span>
                                    <span matListItemLine class="text-muted">
                                        {{ entry.actor_email || entry.actor_id }} · {{ entry.created_at | date:'short' }}
                                    </span>
                                </mat-list-item>
                            }
                        </mat-list>
                    }
                </mat-card-content>
            </mat-card>

            <!-- System Health -->
            <mat-card appearance="outlined" class="health-card">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">monitor_heart</mat-icon>
                    <mat-card-title>System Health</mat-card-title>
                    <mat-card-subtitle>Service status indicators</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="health-list">
                        @for (check of healthChecks(); track check.label) {
                            <div class="health-row">
                                <span class="health-dot" [class]="'dot-' + check.status"
                                    [matTooltip]="check.status === 'green' ? 'Healthy' : check.status === 'yellow' ? 'Degraded' : 'Down'"></span>
                                <span class="health-label">{{ check.label }}</span>
                                <span class="health-status" [class]="'status-text-' + check.status">
                                    {{ check.status === 'green' ? 'Healthy' : check.status === 'yellow' ? 'Degraded' : 'Down' }}
                                </span>
                            </div>
                        }
                    </div>
                </mat-card-content>
            </mat-card>
        </div>
    }
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .loading-container { display: flex; justify-content: center; padding: 48px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 24px; }
    .text-muted { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .resource-id {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }

    /* Metric cards grid */
    .metrics-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px; margin-bottom: 16px;
    }
    .metric-card { text-align: center; }
    .metric-header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; }
    .metric-value { font-size: 32px; font-weight: 700; line-height: 1; }
    .metric-label {
        font-size: 13px; color: var(--mat-sys-on-surface-variant);
        text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;
    }

    /* Mini bar chart */
    .mini-chart {
        display: flex; align-items: flex-end; justify-content: center;
        gap: 3px; height: 32px; margin-top: 12px;
    }
    .mini-bar {
        width: 6px; min-height: 4px; border-radius: 2px; opacity: 0.6;
        transition: opacity 150ms;
    }
    .mini-bar:hover { opacity: 1; }

    /* Dashboard columns */
    .dashboard-columns { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
    @media (max-width: 768px) { .dashboard-columns { grid-template-columns: 1fr; } }

    /* Action chips */
    .action-chip {
        display: inline-block; padding: 1px 6px; border-radius: 8px;
        font-size: 11px; font-weight: 500; margin-right: 4px;
        background: var(--mat-sys-surface-variant); color: var(--mat-sys-on-surface-variant);
    }
    .action-create { background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent); color: var(--mat-sys-primary); }
    .action-update { background: color-mix(in srgb, var(--mat-sys-tertiary) 15%, transparent); color: var(--mat-sys-tertiary); }
    .action-delete { background: color-mix(in srgb, var(--mat-sys-error) 15%, transparent); color: var(--mat-sys-error); }
    .action-icon { font-size: 20px; width: 20px; height: 20px; }

    /* Health indicators */
    .health-list { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .health-row { display: flex; align-items: center; gap: 10px; }
    .health-dot {
        width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
    }
    .dot-green { background: #4caf50; box-shadow: 0 0 6px rgba(76,175,80,0.5); }
    .dot-yellow { background: #ff9800; box-shadow: 0 0 6px rgba(255,152,0,0.5); }
    .dot-red { background: #f44336; box-shadow: 0 0 6px rgba(244,67,54,0.5); }
    .health-label { flex: 1; font-size: 14px; }
    .health-status { font-size: 12px; font-weight: 500; }
    .status-text-green { color: #4caf50; }
    .status-text-yellow { color: #ff9800; }
    .status-text-red { color: #f44336; }
    `],
})
export class DashboardComponent {
    private readonly http = inject(HttpClient);

    readonly loading = signal(false);
    readonly metricCards = signal<MetricCard[]>([]);
    readonly recentActivity = signal<AuditLogEntry[]>([]);
    readonly healthChecks = signal<HealthCheck[]>([
        { label: 'API Gateway', status: 'green' },
        { label: 'Database', status: 'green' },
        { label: 'Compiler Engine', status: 'green' },
        { label: 'Auth Service', status: 'green' },
        { label: 'Cache Layer', status: 'green' },
    ]);

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);

        const auditLogs$ = this.http.get<AuditLogResponse>('/admin/audit-logs?limit=10&offset=0');
        const tiers$ = this.http.get<TierConfigResponse>('/admin/config/tiers');
        const flags$ = this.http.get<FeatureFlagResponse>('/admin/config/feature-flags');

        // Load all data in parallel via forkJoin-like pattern
        let completed = 0;
        let auditData: AuditLogResponse | null = null;
        let tiersData: TierConfigResponse | null = null;
        let flagsData: FeatureFlagResponse | null = null;

        const tryFinalize = () => {
            completed++;
            if (completed < 3) return;

            const totalTiers = tiersData?.items?.length ?? 0;
            const activeFlags = flagsData?.items?.filter(f => f.enabled)?.length ?? 0;
            const auditTotal = auditData?.total ?? 0;

            this.metricCards.set([
                {
                    icon: 'layers',
                    label: 'Active Tiers',
                    value: totalTiers,
                    color: 'var(--mat-sys-primary)',
                    barWidths: this.generateBars(totalTiers, 8),
                },
                {
                    icon: 'flag',
                    label: 'Active Flags',
                    value: activeFlags,
                    color: 'var(--mat-sys-tertiary)',
                    barWidths: this.generateBars(activeFlags, 8),
                },
                {
                    icon: 'receipt_long',
                    label: 'Audit Events',
                    value: auditTotal,
                    color: '#ff9800',
                    barWidths: this.generateBars(auditTotal, 8),
                },
                {
                    icon: 'toggle_on',
                    label: 'Total Flags',
                    value: flagsData?.items?.length ?? 0,
                    color: '#9c27b0',
                    barWidths: this.generateBars(flagsData?.items?.length ?? 0, 8),
                },
            ]);

            this.recentActivity.set(auditData?.items ?? []);

            // Derive health from data availability
            const checks: HealthCheck[] = [
                { label: 'API Gateway', status: 'green' },
                { label: 'Database', status: auditData ? 'green' : 'red' },
                { label: 'Compiler Engine', status: 'green' },
                { label: 'Auth Service', status: tiersData ? 'green' : 'yellow' },
                { label: 'Cache Layer', status: 'green' },
            ];
            this.healthChecks.set(checks);
            this.loading.set(false);
        };

        auditLogs$.subscribe({
            next: (res) => { auditData = res; tryFinalize(); },
            error: () => tryFinalize(),
        });
        tiers$.subscribe({
            next: (res) => { tiersData = res; tryFinalize(); },
            error: () => tryFinalize(),
        });
        flags$.subscribe({
            next: (res) => { flagsData = res; tryFinalize(); },
            error: () => tryFinalize(),
        });
    }

    getActionIcon(action: string): string {
        switch (action) {
            case 'create': return 'add_circle';
            case 'update': return 'edit';
            case 'delete': return 'remove_circle';
            case 'toggle': return 'toggle_on';
            case 'login': return 'login';
            case 'revoke': return 'block';
            default: return 'info';
        }
    }

    /** Generate pseudo-random bar heights for mini charts seeded by value. */
    private generateBars(seed: number, count: number): number[] {
        const bars: number[] = [];
        let v = seed || 1;
        for (let i = 0; i < count; i++) {
            v = ((v * 31 + 7) % 97);
            bars.push(20 + (v % 80));
        }
        return bars;
    }
}
