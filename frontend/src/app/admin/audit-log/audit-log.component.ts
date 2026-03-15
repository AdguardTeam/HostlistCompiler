/**
 * AuditLogComponent — Searchable audit trail viewer.
 *
 * Displays administrative actions with filtering by date range, actor,
 * action type, and resource type. Supports pagination, virtual scrolling,
 * and JSON export of filtered results.
 */

import { Component, afterNextRender, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

interface AuditLogEntry {
    readonly id: number;
    readonly actor_id: string;
    readonly actor_email: string | null;
    readonly action: string;
    readonly resource_type: string;
    readonly resource_id: string | null;
    readonly old_values: unknown;
    readonly new_values: unknown;
    readonly ip_address: string | null;
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

@Component({
    selector: 'app-admin-audit-log',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        DatePipe,
        ScrollingModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">receipt_long</mat-icon>
            <mat-card-title>Audit Log</mat-card-title>
            <mat-card-subtitle>Track administrative actions and system events</mat-card-subtitle>
        </mat-card-header>
    </mat-card>

    <!-- Filters -->
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-content>
            <div class="filters">
                <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Actor</mat-label>
                    <input matInput [(ngModel)]="filterActor" placeholder="Search by actor ID or email" />
                    <mat-icon matSuffix aria-hidden="true">person_search</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Action</mat-label>
                    <mat-select [(ngModel)]="filterAction">
                        <mat-option value="">All</mat-option>
                        @for (a of actionTypes; track a) {
                            <mat-option [value]="a">{{ a }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Resource Type</mat-label>
                    <mat-select [(ngModel)]="filterResourceType">
                        <mat-option value="">All</mat-option>
                        @for (r of resourceTypes; track r) {
                            <mat-option [value]="r">{{ r }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>From</mat-label>
                    <input matInput type="date" [(ngModel)]="filterDateFrom" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>To</mat-label>
                    <input matInput type="date" [(ngModel)]="filterDateTo" />
                </mat-form-field>

                <div class="filter-actions">
                    <button mat-flat-button color="primary" (click)="applyFilters()">
                        <mat-icon aria-hidden="true">search</mat-icon> Search
                    </button>
                    <button mat-stroked-button (click)="resetFilters()">
                        <mat-icon aria-hidden="true">clear</mat-icon> Reset
                    </button>
                    <button mat-stroked-button (click)="exportLogs()" [disabled]="auditLogs().length === 0"
                        matTooltip="Export filtered results as JSON">
                        <mat-icon aria-hidden="true">download</mat-icon> Export
                    </button>
                </div>
            </div>
        </mat-card-content>
    </mat-card>

    <!-- Results table -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (auditLogs().length === 0) {
                <p class="empty-state">No audit log entries found matching the current filters.</p>
            } @else {
                <cdk-virtual-scroll-viewport itemSize="48" class="table-viewport">
                    <table mat-table [dataSource]="auditLogs()" class="audit-table">
                        <ng-container matColumnDef="created_at">
                            <th mat-header-cell *matHeaderCellDef>Timestamp</th>
                            <td mat-cell *matCellDef="let row">{{ row.created_at | date:'short' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="actor">
                            <th mat-header-cell *matHeaderCellDef>Actor</th>
                            <td mat-cell *matCellDef="let row">
                                <span [matTooltip]="row.actor_id">{{ row.actor_email || row.actor_id }}</span>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="action">
                            <th mat-header-cell *matHeaderCellDef>Action</th>
                            <td mat-cell *matCellDef="let row">
                                <span class="action-chip" [class]="'action-' + row.action">{{ row.action }}</span>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="resource_type">
                            <th mat-header-cell *matHeaderCellDef>Resource Type</th>
                            <td mat-cell *matCellDef="let row">{{ row.resource_type }}</td>
                        </ng-container>

                        <ng-container matColumnDef="resource_id">
                            <th mat-header-cell *matHeaderCellDef>Resource ID</th>
                            <td mat-cell *matCellDef="let row">
                                <code class="resource-id">{{ row.resource_id || '—' }}</code>
                            </td>
                        </ng-container>

                        <ng-container matColumnDef="status">
                            <th mat-header-cell *matHeaderCellDef>Status</th>
                            <td mat-cell *matCellDef="let row">
                                <mat-icon [class]="'status-' + row.status" aria-hidden="true"
                                    style="font-size: 18px; width: 18px; height: 18px;">
                                    {{ row.status === 'success' ? 'check_circle' : 'error' }}
                                </mat-icon>
                            </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                    </table>
                </cdk-virtual-scroll-viewport>
            }

            <mat-paginator
                [length]="totalCount()"
                [pageSize]="pageSize"
                [pageSizeOptions]="[25, 50, 100]"
                [pageIndex]="pageIndex()"
                (page)="onPage($event)"
                showFirstLastButtons
            />
        </mat-card-content>
    </mat-card>
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .filters {
        display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start;
    }
    .filter-field { flex: 1; min-width: 200px; }
    .filter-field-sm { min-width: 140px; }
    .filter-actions {
        display: flex; gap: 8px; align-items: center;
        padding-top: 4px;
    }
    .loading-container { display: flex; justify-content: center; padding: 32px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px; }
    .table-viewport { height: 500px; }
    .audit-table { width: 100%; }
    .action-chip {
        display: inline-block; padding: 2px 8px;
        border-radius: 12px; font-size: 12px; font-weight: 500;
        background: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
    }
    .action-create { background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent); color: var(--mat-sys-primary); }
    .action-update { background: color-mix(in srgb, var(--mat-sys-tertiary) 15%, transparent); color: var(--mat-sys-tertiary); }
    .action-delete { background: color-mix(in srgb, var(--mat-sys-error) 15%, transparent); color: var(--mat-sys-error); }
    .resource-id {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .status-success { color: var(--mat-sys-primary); }
    .status-error { color: var(--mat-sys-error); }
    `],
})
export class AuditLogComponent {
    private readonly http = inject(HttpClient);
    private readonly destroyRef = inject(DestroyRef);

    readonly auditLogs = signal<AuditLogEntry[]>([]);
    readonly loading = signal(false);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);

    readonly displayedColumns = ['created_at', 'actor', 'action', 'resource_type', 'resource_id', 'status'];
    readonly pageSize = 25;

    filterActor = '';
    filterAction = '';
    filterResourceType = '';
    filterDateFrom = '';
    filterDateTo = '';

    readonly actionTypes = ['create', 'update', 'delete', 'login', 'revoke', 'toggle', 'override'];
    readonly resourceTypes = ['api_key', 'role', 'tier', 'scope', 'feature_flag', 'announcement', 'endpoint', 'user'];

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        const offset = this.pageIndex() * this.pageSize;

        let params = new HttpParams()
            .set('limit', this.pageSize)
            .set('offset', offset);

        if (this.filterActor) params = params.set('actor', this.filterActor);
        if (this.filterAction) params = params.set('action', this.filterAction);
        if (this.filterResourceType) params = params.set('resource_type', this.filterResourceType);
        if (this.filterDateFrom) params = params.set('from', this.filterDateFrom);
        if (this.filterDateTo) params = params.set('to', this.filterDateTo);

        this.http.get<AuditLogResponse>('/admin/system/audit', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (res) => {
                this.auditLogs.set(res.items ?? []);
                this.totalCount.set(res.total ?? 0);
                this.loading.set(false);
            },
            error: () => {
                this.auditLogs.set([]);
                this.totalCount.set(0);
                this.loading.set(false);
            },
        });
    }

    applyFilters(): void {
        this.pageIndex.set(0);
        this.loadData();
    }

    resetFilters(): void {
        this.filterActor = '';
        this.filterAction = '';
        this.filterResourceType = '';
        this.filterDateFrom = '';
        this.filterDateTo = '';
        this.pageIndex.set(0);
        this.loadData();
    }

    onPage(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.loadData();
    }

    exportLogs(): void {
        const data = JSON.stringify(this.auditLogs(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
