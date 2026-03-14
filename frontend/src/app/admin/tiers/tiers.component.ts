/**
 * TiersComponent — Tier registry editor.
 *
 * Provides a sortable Material table of subscription tiers with
 * create, edit, and delete operations via overlay dialogs.
 */

import {
    Component, afterNextRender, inject, signal,
    ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface TierConfig {
    readonly id: number;
    readonly tier_name: string;
    readonly display_name: string;
    readonly description: string;
    readonly order_rank: number;
    readonly rate_limit: number;
    readonly features: Record<string, unknown>;
    readonly is_active: boolean;
    readonly created_at: string;
    readonly updated_at: string;
}

interface TierListResponse {
    readonly success: boolean;
    readonly items: TierConfig[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

interface TierFormData {
    tier_name: string;
    display_name: string;
    description: string;
    order_rank: number;
    rate_limit: number;
    is_active: boolean;
}

@Component({
    selector: 'app-admin-tiers',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        DecimalPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatTableModule,
        MatSortModule,
        MatSlideToggleModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatChipsModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">layers</mat-icon>
            <mat-card-title>Tier Registry</mat-card-title>
            <mat-card-subtitle>{{ tiers().length }} tiers configured</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-flat-button color="primary" (click)="openCreateDialog()">
                <mat-icon aria-hidden="true">add</mat-icon> Create Tier
            </button>
        </mat-card-actions>
    </mat-card>

    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (tiers().length === 0) {
                <p class="empty-state">No tiers configured yet. Create one to get started.</p>
            } @else {
                <table mat-table [dataSource]="sortedTiers()" matSort (matSortChange)="onSort($event)" class="tiers-table">
                    <ng-container matColumnDef="order_rank">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Order</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="order-badge">{{ row.order_rank }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="tier_name">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Tier Name</th>
                        <td mat-cell *matCellDef="let row">
                            <code class="tier-code">{{ row.tier_name }}</code>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="display_name">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Display Name</th>
                        <td mat-cell *matCellDef="let row">{{ row.display_name }}</td>
                    </ng-container>

                    <ng-container matColumnDef="rate_limit">
                        <th mat-header-cell *matHeaderCellDef mat-sort-header>Rate Limit</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="rate-badge">{{ row.rate_limit | number }} req/min</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="description">
                        <th mat-header-cell *matHeaderCellDef>Description</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="description-text">{{ row.description || '—' }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="is_active">
                        <th mat-header-cell *matHeaderCellDef>Active</th>
                        <td mat-cell *matCellDef="let row">
                            <mat-icon [class]="row.is_active ? 'status-active' : 'status-inactive'" aria-hidden="true"
                                [matTooltip]="row.is_active ? 'Active' : 'Inactive'">
                                {{ row.is_active ? 'check_circle' : 'cancel' }}
                            </mat-icon>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="Edit tier" (click)="openEditDialog(row)">
                                <mat-icon aria-hidden="true">edit</mat-icon>
                            </button>
                            <button mat-icon-button color="warn" matTooltip="Delete tier" (click)="openDeleteConfirm(row)">
                                <mat-icon aria-hidden="true">delete</mat-icon>
                            </button>
                        </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>
            }
        </mat-card-content>
    </mat-card>

    <!-- Create / Edit Dialog -->
    @if (dialogMode()) {
        <div class="overlay" (click)="closeDialog()" (keydown.enter)="closeDialog()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">{{ dialogMode() === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
                    <mat-card-title>{{ dialogMode() === 'create' ? 'Create Tier' : 'Edit Tier' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="dialog-form">
                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Tier Name</mat-label>
                            <input matInput [(ngModel)]="formData.tier_name" placeholder="e.g. pro"
                                [disabled]="dialogMode() === 'edit'" />
                            <mat-hint>Unique identifier (snake_case)</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Display Name</mat-label>
                            <input matInput [(ngModel)]="formData.display_name" placeholder="Professional" />
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Description</mat-label>
                            <textarea matInput [(ngModel)]="formData.description" rows="2"></textarea>
                        </mat-form-field>

                        <div class="form-row">
                            <mat-form-field appearance="outline">
                                <mat-label>Order Rank</mat-label>
                                <input matInput type="number" [(ngModel)]="formData.order_rank" min="0" />
                            </mat-form-field>

                            <mat-form-field appearance="outline">
                                <mat-label>Rate Limit (req/min)</mat-label>
                                <input matInput type="number" [(ngModel)]="formData.rate_limit" min="0" />
                            </mat-form-field>
                        </div>

                        <mat-slide-toggle [(ngModel)]="formData.is_active">Active</mat-slide-toggle>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDialog()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveTier()" [disabled]="saving()">
                        @if (saving()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            {{ dialogMode() === 'create' ? 'Create' : 'Save' }}
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        </div>
    }

    <!-- Delete Confirmation -->
    @if (deletingTier()) {
        <div class="overlay" (click)="closeDeleteConfirm()" (keydown.enter)="closeDeleteConfirm()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-error)" aria-hidden="true">warning</mat-icon>
                    <mat-card-title>Delete Tier</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <p>Are you sure you want to delete the <strong>{{ deletingTier()!.display_name }}</strong> tier?
                    Users on this tier will need to be migrated. This cannot be undone.</p>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDeleteConfirm()">Cancel</button>
                    <button mat-flat-button color="warn" (click)="confirmDelete()" [disabled]="saving()">
                        @if (saving()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            Delete
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        </div>
    }
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .loading-container { display: flex; justify-content: center; padding: 32px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px; }
    .full-width { width: 100%; }

    .tiers-table { width: 100%; }

    .order-badge {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; border-radius: 50%;
        font-size: 13px; font-weight: 700;
        background: var(--mat-sys-surface-variant); color: var(--mat-sys-on-surface-variant);
    }
    .tier-code {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .rate-badge {
        display: inline-block; padding: 2px 8px; border-radius: 12px;
        font-size: 12px; font-weight: 600;
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
        color: var(--mat-sys-primary);
    }
    .description-text {
        font-size: 13px; max-width: 240px; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; display: block;
    }
    .status-active { color: var(--mat-sys-primary); font-size: 20px; }
    .status-inactive { color: var(--mat-sys-on-surface-variant); font-size: 20px; opacity: 0.4; }

    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .dialog-card { width: 520px; max-width: 90vw; }
    .dialog-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    `],
})
export class TiersComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly tiers = signal<TierConfig[]>([]);
    readonly sortedTiers = signal<TierConfig[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly dialogMode = signal<'create' | 'edit' | null>(null);
    readonly editingTierName = signal<string | null>(null);
    readonly deletingTier = signal<TierConfig | null>(null);

    readonly displayedColumns = ['order_rank', 'tier_name', 'display_name', 'rate_limit', 'description', 'is_active', 'actions'];

    private currentSort: Sort = { active: 'order_rank', direction: 'asc' };

    formData: TierFormData = this.emptyForm();

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<TierListResponse>('/admin/config/tiers').subscribe({
            next: (res) => {
                this.tiers.set(res.items ?? []);
                this.applySorting(res.items ?? []);
                this.loading.set(false);
            },
            error: () => {
                this.tiers.set([]);
                this.sortedTiers.set([]);
                this.loading.set(false);
            },
        });
    }

    onSort(sort: Sort): void {
        this.currentSort = sort;
        this.applySorting(this.tiers());
    }

    private applySorting(data: TierConfig[]): void {
        const sorted = [...data];
        const { active, direction } = this.currentSort;
        if (!active || direction === '') {
            this.sortedTiers.set(sorted);
            return;
        }

        sorted.sort((a, b) => {
            const aVal = (a as unknown as Record<string, unknown>)[active];
            const bVal = (b as unknown as Record<string, unknown>)[active];
            let cmp: number;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                cmp = aVal - bVal;
            } else {
                cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''));
            }
            return direction === 'asc' ? cmp : -cmp;
        });
        this.sortedTiers.set(sorted);
    }

    openCreateDialog(): void {
        this.formData = this.emptyForm();
        this.editingTierName.set(null);
        this.dialogMode.set('create');
    }

    openEditDialog(tier: TierConfig): void {
        this.formData = {
            tier_name: tier.tier_name,
            display_name: tier.display_name,
            description: tier.description,
            order_rank: tier.order_rank,
            rate_limit: tier.rate_limit,
            is_active: tier.is_active,
        };
        this.editingTierName.set(tier.tier_name);
        this.dialogMode.set('edit');
    }

    closeDialog(): void {
        this.dialogMode.set(null);
    }

    saveTier(): void {
        this.saving.set(true);
        const payload = { ...this.formData };

        const request = this.dialogMode() === 'create'
            ? this.http.post('/admin/config/tiers', payload)
            : this.http.patch(`/admin/config/tiers/${this.editingTierName()}`, payload);

        request.subscribe({
            next: () => {
                this.snackBar.open(
                    this.dialogMode() === 'create' ? 'Tier created' : 'Tier updated',
                    'OK', { duration: 3000 },
                );
                this.saving.set(false);
                this.closeDialog();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to save tier', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    openDeleteConfirm(tier: TierConfig): void {
        this.deletingTier.set(tier);
    }

    closeDeleteConfirm(): void {
        this.deletingTier.set(null);
    }

    confirmDelete(): void {
        const tier = this.deletingTier();
        if (!tier) return;

        this.saving.set(true);
        this.http.delete(`/admin/config/tiers/${tier.tier_name}`).subscribe({
            next: () => {
                this.snackBar.open(`Tier "${tier.display_name}" deleted`, 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeDeleteConfirm();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to delete tier', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    private emptyForm(): TierFormData {
        return {
            tier_name: '',
            display_name: '',
            description: '',
            order_rank: 0,
            rate_limit: 100,
            is_active: true,
        };
    }
}
