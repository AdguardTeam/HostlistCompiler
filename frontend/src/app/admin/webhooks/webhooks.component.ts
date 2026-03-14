/**
 * WebhooksComponent — Clerk webhook event viewer.
 *
 * Displays recent Clerk webhook events in a read-only Material table
 * with a secondary "DLQ" tab for failed events. Gracefully handles
 * 404 responses (API not yet implemented) with a "Coming soon" message.
 */

import { Component, afterNextRender, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

interface WebhookEvent {
    readonly id: string;
    readonly event_type: string;
    readonly user_id: string | null;
    readonly status: string;
    readonly processing_time_ms: number | null;
    readonly error_message: string | null;
    readonly created_at: string;
}

interface WebhookEventsResponse {
    readonly success: boolean;
    readonly items: WebhookEvent[];
    readonly total: number;
}

@Component({
    selector: 'app-admin-webhooks',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatTabsModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">webhook</mat-icon>
            <mat-card-title>Webhooks</mat-card-title>
            <mat-card-subtitle>Clerk webhook event viewer</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-stroked-button (click)="loadData()" [disabled]="loading()">
                <mat-icon aria-hidden="true">refresh</mat-icon> Refresh
            </button>
        </mat-card-actions>
    </mat-card>

    @if (apiUnavailable()) {
        <mat-card appearance="outlined">
            <mat-card-content>
                <div class="coming-soon">
                    <mat-icon aria-hidden="true" class="coming-soon-icon">construction</mat-icon>
                    <h3>Coming Soon</h3>
                    <p>The webhook events API is not yet available. This viewer will display Clerk webhook events
                       once the <code>/admin/webhooks/events</code> endpoint is implemented.</p>
                </div>
            </mat-card-content>
        </mat-card>
    } @else {
        <mat-card appearance="outlined">
            <mat-tab-group (selectedIndexChange)="onTabChange($event)">
                <!-- Events tab -->
                <mat-tab>
                    <ng-template mat-tab-label>
                        <mat-icon aria-hidden="true">list</mat-icon>&nbsp;Events ({{ events().length }})
                    </ng-template>
                    <div class="tab-content">
                        @if (loading()) {
                            <div class="loading-container">
                                <mat-progress-spinner diameter="40" mode="indeterminate" />
                            </div>
                        } @else if (events().length === 0) {
                            <p class="empty-state">No webhook events recorded yet.</p>
                        } @else {
                            <table mat-table [dataSource]="events()" class="webhooks-table">
                                <ng-container matColumnDef="created_at">
                                    <th mat-header-cell *matHeaderCellDef>Timestamp</th>
                                    <td mat-cell *matCellDef="let row">{{ row.created_at | date:'short' }}</td>
                                </ng-container>

                                <ng-container matColumnDef="event_type">
                                    <th mat-header-cell *matHeaderCellDef>Event Type</th>
                                    <td mat-cell *matCellDef="let row">
                                        <code class="event-type">{{ row.event_type }}</code>
                                    </td>
                                </ng-container>

                                <ng-container matColumnDef="user_id">
                                    <th mat-header-cell *matHeaderCellDef>User ID</th>
                                    <td mat-cell *matCellDef="let row">
                                        <code class="user-id">{{ row.user_id || '—' }}</code>
                                    </td>
                                </ng-container>

                                <ng-container matColumnDef="status">
                                    <th mat-header-cell *matHeaderCellDef>Status</th>
                                    <td mat-cell *matCellDef="let row">
                                        <span class="status-chip" [class]="'status-' + row.status">{{ row.status }}</span>
                                    </td>
                                </ng-container>

                                <ng-container matColumnDef="processing_time">
                                    <th mat-header-cell *matHeaderCellDef>Time (ms)</th>
                                    <td mat-cell *matCellDef="let row">
                                        {{ row.processing_time_ms !== null ? row.processing_time_ms + 'ms' : '—' }}
                                    </td>
                                </ng-container>

                                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                            </table>
                        }
                    </div>
                </mat-tab>

                <!-- DLQ tab -->
                <mat-tab>
                    <ng-template mat-tab-label>
                        <mat-icon aria-hidden="true">error_outline</mat-icon>&nbsp;DLQ ({{ dlqEvents().length }})
                    </ng-template>
                    <div class="tab-content">
                        @if (loadingDlq()) {
                            <div class="loading-container">
                                <mat-progress-spinner diameter="40" mode="indeterminate" />
                            </div>
                        } @else if (dlqEvents().length === 0) {
                            <p class="empty-state">No failed webhook events. Everything is healthy!</p>
                        } @else {
                            <table mat-table [dataSource]="dlqEvents()" class="webhooks-table">
                                <ng-container matColumnDef="created_at">
                                    <th mat-header-cell *matHeaderCellDef>Timestamp</th>
                                    <td mat-cell *matCellDef="let row">{{ row.created_at | date:'short' }}</td>
                                </ng-container>

                                <ng-container matColumnDef="event_type">
                                    <th mat-header-cell *matHeaderCellDef>Event Type</th>
                                    <td mat-cell *matCellDef="let row">
                                        <code class="event-type">{{ row.event_type }}</code>
                                    </td>
                                </ng-container>

                                <ng-container matColumnDef="user_id">
                                    <th mat-header-cell *matHeaderCellDef>User ID</th>
                                    <td mat-cell *matCellDef="let row">
                                        <code class="user-id">{{ row.user_id || '—' }}</code>
                                    </td>
                                </ng-container>

                                <ng-container matColumnDef="status">
                                    <th mat-header-cell *matHeaderCellDef>Status</th>
                                    <td mat-cell *matCellDef="let row">
                                        <span class="status-chip status-failed">{{ row.status }}</span>
                                    </td>
                                </ng-container>

                                <ng-container matColumnDef="error_message">
                                    <th mat-header-cell *matHeaderCellDef>Error</th>
                                    <td mat-cell *matCellDef="let row">
                                        <span class="error-text" [matTooltip]="row.error_message || ''">
                                            {{ row.error_message || '—' }}
                                        </span>
                                    </td>
                                </ng-container>

                                <tr mat-header-row *matHeaderRowDef="dlqColumns"></tr>
                                <tr mat-row *matRowDef="let row; columns: dlqColumns;"></tr>
                            </table>
                        }
                    </div>
                </mat-tab>
            </mat-tab-group>
        </mat-card>
    }
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .loading-container { display: flex; justify-content: center; padding: 32px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px; }
    .tab-content { padding: 16px 0; }
    .webhooks-table { width: 100%; }
    .event-type {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .user-id {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
    }
    .status-chip {
        display: inline-block; padding: 2px 8px; border-radius: 12px;
        font-size: 12px; font-weight: 500;
    }
    .status-success, .status-processed {
        background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent);
        color: var(--mat-sys-primary);
    }
    .status-failed, .status-error {
        background: color-mix(in srgb, var(--mat-sys-error) 15%, transparent);
        color: var(--mat-sys-error);
    }
    .status-pending {
        background: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
    }
    .error-text {
        font-size: 12px; color: var(--mat-sys-error);
        max-width: 200px; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; display: block;
    }
    .coming-soon {
        text-align: center; padding: 48px 24px;
        color: var(--mat-sys-on-surface-variant);
    }
    .coming-soon-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.6; }
    .coming-soon h3 { margin: 16px 0 8px; }
    .coming-soon code {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    `],
})
export class WebhooksComponent {
    private readonly http = inject(HttpClient);

    readonly events = signal<WebhookEvent[]>([]);
    readonly dlqEvents = signal<WebhookEvent[]>([]);
    readonly loading = signal(false);
    readonly loadingDlq = signal(false);
    readonly apiUnavailable = signal(false);

    readonly displayedColumns = ['created_at', 'event_type', 'user_id', 'status', 'processing_time'];
    readonly dlqColumns = ['created_at', 'event_type', 'user_id', 'status', 'error_message'];

    private dlqLoaded = false;

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.apiUnavailable.set(false);

        this.http.get<WebhookEventsResponse>('/admin/webhooks/events').subscribe({
            next: (res) => {
                this.events.set(res.items ?? []);
                this.loading.set(false);
            },
            error: (err: HttpErrorResponse) => {
                if (err.status === 404) {
                    this.apiUnavailable.set(true);
                } else {
                    this.events.set([]);
                }
                this.loading.set(false);
            },
        });
    }

    onTabChange(index: number): void {
        if (index === 1 && !this.dlqLoaded) {
            this.loadDlq();
        }
    }

    private loadDlq(): void {
        this.loadingDlq.set(true);
        this.http.get<WebhookEventsResponse>('/admin/webhooks/events/dlq').subscribe({
            next: (res) => {
                this.dlqEvents.set(res.items ?? []);
                this.loadingDlq.set(false);
                this.dlqLoaded = true;
            },
            error: () => {
                this.dlqEvents.set([]);
                this.loadingDlq.set(false);
                this.dlqLoaded = true;
            },
        });
    }
}
