/**
 * ApiKeysComponent — Admin API key management panel.
 *
 * Displays all API keys across users with search, status filtering,
 * revocation, and a detail overlay. Shows stats summary at top.
 * Uses signal-based state and calls the admin auth REST API.
 */

import {
    Component, afterNextRender, inject, signal, computed,
    ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface AdminApiKey {
    readonly id: string;
    readonly keyPrefix: string;
    readonly clerkUserId: string;
    readonly name: string;
    readonly scopes: string[];
    readonly rateLimitPerMinute: number;
    readonly lastUsedAt: string | null;
    readonly expiresAt: string | null;
    readonly revokedAt: string | null;
    readonly createdAt: string;
}

interface AdminApiKeyListResponse {
    readonly success: boolean;
    readonly keys: AdminApiKey[];
    readonly total: number;
}

type KeyStatus = 'all' | 'active' | 'revoked' | 'expired';

@Component({
    selector: 'app-admin-api-keys',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatTooltipModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">vpn_key</mat-icon>
            <mat-card-title>API Key Management</mat-card-title>
            <mat-card-subtitle>{{ allKeys().length }} keys across all users</mat-card-subtitle>
        </mat-card-header>
    </mat-card>

    <!-- Stats summary -->
    <div class="stats-row mb-2">
        <mat-card appearance="outlined" class="stat-card">
            <mat-card-content>
                <div class="stat-value">{{ stats().total }}</div>
                <div class="stat-label">Total Keys</div>
            </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined" class="stat-card">
            <mat-card-content>
                <div class="stat-value stat-active">{{ stats().active }}</div>
                <div class="stat-label">Active</div>
            </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined" class="stat-card">
            <mat-card-content>
                <div class="stat-value stat-revoked">{{ stats().revoked }}</div>
                <div class="stat-label">Revoked</div>
            </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined" class="stat-card">
            <mat-card-content>
                <div class="stat-value stat-expired">{{ stats().expired }}</div>
                <div class="stat-label">Expired</div>
            </mat-card-content>
        </mat-card>
    </div>

    <!-- Filters -->
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-content>
            <div class="filters">
                <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Search by prefix or owner</mat-label>
                    <input matInput [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" placeholder="abc_ or user_..." />
                    <mat-icon matSuffix aria-hidden="true">search</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Status</mat-label>
                    <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
                        <mat-option value="all">All</mat-option>
                        <mat-option value="active">Active</mat-option>
                        <mat-option value="revoked">Revoked</mat-option>
                        <mat-option value="expired">Expired</mat-option>
                    </mat-select>
                </mat-form-field>
            </div>
        </mat-card-content>
    </mat-card>

    <!-- Keys table -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (filteredKeys().length === 0) {
                <p class="empty-state">No API keys match the current filters.</p>
            } @else {
                <table mat-table [dataSource]="filteredKeys()" class="keys-table">
                    <ng-container matColumnDef="keyPrefix">
                        <th mat-header-cell *matHeaderCellDef>Prefix</th>
                        <td mat-cell *matCellDef="let row">
                            <code class="key-prefix">{{ row.keyPrefix }}</code>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="clerkUserId">
                        <th mat-header-cell *matHeaderCellDef>Owner</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="owner-id">{{ row.clerkUserId }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="name">
                        <th mat-header-cell *matHeaderCellDef>Name</th>
                        <td mat-cell *matCellDef="let row">{{ row.name }}</td>
                    </ng-container>

                    <ng-container matColumnDef="scopes">
                        <th mat-header-cell *matHeaderCellDef>Scopes</th>
                        <td mat-cell *matCellDef="let row">
                            @for (s of row.scopes; track s) {
                                <span class="scope-chip">{{ s }}</span>
                            } @empty {
                                <span class="text-muted">None</span>
                            }
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Status</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="status-chip" [class]="'status-' + getKeyStatus(row)">
                                {{ getKeyStatus(row) }}
                            </span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="createdAt">
                        <th mat-header-cell *matHeaderCellDef>Created</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="text-muted">{{ formatDate(row.createdAt) }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="View details" (click)="openDetail(row)">
                                <mat-icon aria-hidden="true">visibility</mat-icon>
                            </button>
                            @if (!row.revokedAt) {
                                <button mat-icon-button color="warn" matTooltip="Revoke key" (click)="openRevokeConfirm(row)">
                                    <mat-icon aria-hidden="true">block</mat-icon>
                                </button>
                            }
                        </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>
            }
        </mat-card-content>
    </mat-card>

    <!-- Detail overlay -->
    @if (detailKey()) {
        <div class="overlay" (click)="closeDetail()">
            <mat-card appearance="outlined" class="detail-dialog" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">info</mat-icon>
                    <mat-card-title>Key Details</mat-card-title>
                    <mat-card-subtitle>{{ detailKey()!.keyPrefix }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="detail-grid">
                        <div class="detail-row">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">{{ detailKey()!.name }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Owner</span>
                            <code class="detail-value">{{ detailKey()!.clerkUserId }}</code>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Prefix</span>
                            <code class="detail-value">{{ detailKey()!.keyPrefix }}</code>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Rate Limit</span>
                            <span class="detail-value">{{ detailKey()!.rateLimitPerMinute }}/min</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Scopes</span>
                            <span class="detail-value">
                                @for (s of detailKey()!.scopes; track s) {
                                    <span class="scope-chip">{{ s }}</span>
                                } @empty {
                                    <span class="text-muted">None</span>
                                }
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="status-chip" [class]="'status-' + getKeyStatus(detailKey()!)">
                                {{ getKeyStatus(detailKey()!) }}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Created</span>
                            <span class="detail-value">{{ detailKey()!.createdAt }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Used</span>
                            <span class="detail-value">{{ detailKey()!.lastUsedAt || '—' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Expires</span>
                            <span class="detail-value">{{ detailKey()!.expiresAt || 'Never' }}</span>
                        </div>
                        @if (detailKey()!.revokedAt) {
                            <div class="detail-row">
                                <span class="detail-label">Revoked</span>
                                <span class="detail-value" style="color: var(--mat-sys-error)">{{ detailKey()!.revokedAt }}</span>
                            </div>
                        }
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDetail()">Close</button>
                </mat-card-actions>
            </mat-card>
        </div>
    }

    <!-- Revoke confirmation -->
    @if (revokingKey()) {
        <div class="overlay" (click)="closeRevokeConfirm()">
            <mat-card appearance="outlined" class="detail-dialog" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-error)" aria-hidden="true">warning</mat-icon>
                    <mat-card-title>Revoke API Key</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <p>Are you sure you want to revoke key <strong>{{ revokingKey()!.keyPrefix }}</strong> ({{ revokingKey()!.name }})? This cannot be undone.</p>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeRevokeConfirm()">Cancel</button>
                    <button mat-flat-button color="warn" (click)="confirmRevoke()" [disabled]="saving()">
                        @if (saving()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            Revoke
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        </div>
    }
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .stats-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 140px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: var(--mat-sys-on-surface); }
    .stat-active { color: #2e7d32; }
    .stat-revoked { color: #c62828; }
    .stat-expired { color: #ef6c00; }
    .stat-label { font-size: 12px; color: var(--mat-sys-on-surface-variant); text-transform: uppercase; letter-spacing: 0.06em; }
    .filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
    .filter-field { flex: 1; min-width: 200px; }
    .filter-field-sm { min-width: 140px; }
    .loading-container { display: flex; justify-content: center; padding: 32px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px; }
    .keys-table { width: 100%; }
    .key-prefix {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .owner-id { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .scope-chip {
        display: inline-block; padding: 1px 6px; border-radius: 8px;
        font-size: 11px; margin-right: 4px;
        background: var(--mat-sys-surface-variant); color: var(--mat-sys-on-surface-variant);
    }
    .status-chip {
        display: inline-block; padding: 2px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 600; text-transform: capitalize;
    }
    .status-active { background: #e8f5e9; color: #2e7d32; }
    .status-revoked { background: #fce4ec; color: #c62828; }
    .status-expired { background: #fff3e0; color: #ef6c00; }
    .text-muted { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .detail-dialog { width: 520px; max-width: 90vw; }
    .detail-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .detail-label { font-size: 13px; font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    .detail-value { font-size: 13px; }
    `],
})
export class ApiKeysComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly allKeys = signal<AdminApiKey[]>([]);
    readonly filteredKeys = signal<AdminApiKey[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly detailKey = signal<AdminApiKey | null>(null);
    readonly revokingKey = signal<AdminApiKey | null>(null);

    readonly displayedColumns = ['keyPrefix', 'clerkUserId', 'name', 'scopes', 'status', 'createdAt', 'actions'];

    searchQuery = '';
    statusFilter: KeyStatus = 'all';

    readonly stats = computed(() => {
        const keys = this.allKeys();
        const now = new Date().toISOString();
        return {
            total: keys.length,
            active: keys.filter(k => !k.revokedAt && (!k.expiresAt || k.expiresAt >= now)).length,
            revoked: keys.filter(k => !!k.revokedAt).length,
            expired: keys.filter(k => !k.revokedAt && !!k.expiresAt && k.expiresAt < now).length,
        };
    });

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<AdminApiKeyListResponse>('/admin/auth/api-keys').subscribe({
            next: (res) => {
                this.allKeys.set(res.keys ?? []);
                this.applyFilters();
                this.loading.set(false);
            },
            error: () => {
                this.allKeys.set([]);
                this.filteredKeys.set([]);
                this.loading.set(false);
            },
        });
    }

    applyFilters(): void {
        let keys = this.allKeys();
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            keys = keys.filter(k =>
                k.keyPrefix.toLowerCase().includes(q) ||
                k.clerkUserId.toLowerCase().includes(q) ||
                k.name.toLowerCase().includes(q),
            );
        }
        if (this.statusFilter !== 'all') {
            const now = new Date().toISOString();
            keys = keys.filter(k => {
                const status = this.getKeyStatus(k);
                return status === this.statusFilter;
            });
        }
        this.filteredKeys.set(keys);
    }

    getKeyStatus(key: AdminApiKey): string {
        if (key.revokedAt) return 'revoked';
        if (key.expiresAt && key.expiresAt < new Date().toISOString()) return 'expired';
        return 'active';
    }

    formatDate(dateStr: string | null): string {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString();
    }

    openDetail(key: AdminApiKey): void {
        this.detailKey.set(key);
    }

    closeDetail(): void {
        this.detailKey.set(null);
    }

    openRevokeConfirm(key: AdminApiKey): void {
        this.revokingKey.set(key);
    }

    closeRevokeConfirm(): void {
        this.revokingKey.set(null);
    }

    confirmRevoke(): void {
        const key = this.revokingKey();
        if (!key) return;

        this.saving.set(true);
        this.http.post('/admin/auth/api-keys/revoke', { id: key.id }).subscribe({
            next: () => {
                this.snackBar.open(`Key "${key.keyPrefix}" revoked`, 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeRevokeConfirm();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to revoke key', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }
}
