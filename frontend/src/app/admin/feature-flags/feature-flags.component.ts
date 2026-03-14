/**
 * FeatureFlagsComponent — Feature flag management panel.
 *
 * Provides a table of feature flags with inline toggle, creation dialog,
 * edit dialog, and delete confirmation. Uses signal-based state and
 * calls the admin feature-flags REST API.
 */

import {
    Component, afterNextRender, inject, signal,
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface FeatureFlag {
    readonly id: number;
    readonly flag_name: string;
    readonly enabled: boolean;
    readonly rollout_percentage: number;
    readonly target_tiers: string[];
    readonly target_users: string[];
    readonly description: string;
    readonly created_by: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}

interface FeatureFlagListResponse {
    readonly success: boolean;
    readonly items: FeatureFlag[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

interface FlagFormData {
    flag_name: string;
    description: string;
    enabled: boolean;
    rollout_percentage: number;
    target_tiers: string[];
    target_users: string;
}

@Component({
    selector: 'app-admin-feature-flags',
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
        MatSlideToggleModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatTooltipModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">flag</mat-icon>
            <mat-card-title>Feature Flags</mat-card-title>
            <mat-card-subtitle>{{ flags().length }} flags configured</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-flat-button color="primary" (click)="openCreateDialog()">
                <mat-icon aria-hidden="true">add</mat-icon> Create Flag
            </button>
        </mat-card-actions>
    </mat-card>

    <!-- Flags table -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (flags().length === 0) {
                <p class="empty-state">No feature flags configured yet. Create one to get started.</p>
            } @else {
                <table mat-table [dataSource]="flags()" class="flags-table">
                    <ng-container matColumnDef="flag_name">
                        <th mat-header-cell *matHeaderCellDef>Flag Name</th>
                        <td mat-cell *matCellDef="let row">
                            <code class="flag-name">{{ row.flag_name }}</code>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="enabled">
                        <th mat-header-cell *matHeaderCellDef>Enabled</th>
                        <td mat-cell *matCellDef="let row">
                            <mat-slide-toggle
                                [checked]="row.enabled"
                                (change)="toggleFlag(row, $event.checked)"
                                [matTooltip]="row.enabled ? 'Click to disable' : 'Click to enable'"
                            />
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="rollout_percentage">
                        <th mat-header-cell *matHeaderCellDef>Rollout %</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="rollout-badge">{{ row.rollout_percentage }}%</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="target_tiers">
                        <th mat-header-cell *matHeaderCellDef>Target Tiers</th>
                        <td mat-cell *matCellDef="let row">
                            @for (t of row.target_tiers; track t) {
                                <span class="tier-chip">{{ t }}</span>
                            } @empty {
                                <span class="text-muted">All</span>
                            }
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="description">
                        <th mat-header-cell *matHeaderCellDef>Description</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="description-text">{{ row.description || '—' }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="Edit flag" (click)="openEditDialog(row)">
                                <mat-icon aria-hidden="true">edit</mat-icon>
                            </button>
                            <button mat-icon-button color="warn" matTooltip="Delete flag" (click)="openDeleteConfirm(row)">
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

    <!-- Create / Edit dialog -->
    @if (dialogMode()) {
        <div class="overlay" (click)="closeDialog()">
            <mat-card appearance="outlined" class="flag-dialog" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">{{ dialogMode() === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
                    <mat-card-title>{{ dialogMode() === 'create' ? 'Create Feature Flag' : 'Edit Feature Flag' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="dialog-form">
                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Flag Name</mat-label>
                            <input matInput [(ngModel)]="formData.flag_name" placeholder="e.g. enable_new_compiler"
                                [disabled]="dialogMode() === 'edit'" />
                            <mat-hint>Unique identifier (snake_case)</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Description</mat-label>
                            <textarea matInput [(ngModel)]="formData.description" rows="2"
                                placeholder="What does this flag control?"></textarea>
                        </mat-form-field>

                        <mat-slide-toggle [(ngModel)]="formData.enabled">Enabled</mat-slide-toggle>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Rollout Percentage</mat-label>
                            <input matInput type="number" [(ngModel)]="formData.rollout_percentage"
                                min="0" max="100" />
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Target Tiers</mat-label>
                            <mat-select [(ngModel)]="formData.target_tiers" multiple>
                                @for (t of allTiers; track t) {
                                    <mat-option [value]="t">{{ t }}</mat-option>
                                }
                            </mat-select>
                            <mat-hint>Leave empty for all tiers</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Target Users (comma-separated IDs)</mat-label>
                            <input matInput [(ngModel)]="formData.target_users" placeholder="user_123, user_456" />
                        </mat-form-field>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDialog()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveFlag()" [disabled]="saving()">
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

    <!-- Delete confirmation -->
    @if (deletingFlag()) {
        <div class="overlay" (click)="closeDeleteConfirm()">
            <mat-card appearance="outlined" class="flag-dialog" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-error)" aria-hidden="true">warning</mat-icon>
                    <mat-card-title>Delete Flag</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <p>Are you sure you want to delete <strong>{{ deletingFlag()!.flag_name }}</strong>? This cannot be undone.</p>
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
    .flags-table { width: 100%; }
    .flag-name {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .rollout-badge {
        display: inline-block; padding: 2px 8px; border-radius: 12px;
        font-size: 12px; font-weight: 600;
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
        color: var(--mat-sys-primary);
    }
    .tier-chip {
        display: inline-block; padding: 1px 6px; border-radius: 8px;
        font-size: 11px; margin-right: 4px;
        background: var(--mat-sys-surface-variant); color: var(--mat-sys-on-surface-variant);
    }
    .text-muted { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .description-text { font-size: 13px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .flag-dialog { width: 520px; max-width: 90vw; }
    .dialog-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .full-width { width: 100%; }
    `],
})
export class FeatureFlagsComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly flags = signal<FeatureFlag[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly dialogMode = signal<'create' | 'edit' | null>(null);
    readonly editingFlagId = signal<number | null>(null);
    readonly deletingFlag = signal<FeatureFlag | null>(null);

    readonly displayedColumns = ['flag_name', 'enabled', 'rollout_percentage', 'target_tiers', 'description', 'actions'];
    readonly allTiers = ['free', 'starter', 'pro', 'enterprise', 'internal'];

    formData: FlagFormData = this.emptyForm();

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<FeatureFlagListResponse>('/admin/config/feature-flags').subscribe({
            next: (res) => {
                this.flags.set(res.items ?? []);
                this.loading.set(false);
            },
            error: () => {
                this.flags.set([]);
                this.loading.set(false);
            },
        });
    }

    toggleFlag(flag: FeatureFlag, enabled: boolean): void {
        this.http.patch(`/admin/config/feature-flags/${flag.id}`, { enabled }).subscribe({
            next: () => {
                this.flags.update(flags =>
                    flags.map(f => f.id === flag.id ? { ...f, enabled } : f),
                );
                this.snackBar.open(`Flag "${flag.flag_name}" ${enabled ? 'enabled' : 'disabled'}`, 'OK', { duration: 2000 });
            },
            error: () => {
                this.snackBar.open('Failed to update flag', 'Dismiss', { duration: 3000 });
            },
        });
    }

    openCreateDialog(): void {
        this.formData = this.emptyForm();
        this.editingFlagId.set(null);
        this.dialogMode.set('create');
    }

    openEditDialog(flag: FeatureFlag): void {
        this.formData = {
            flag_name: flag.flag_name,
            description: flag.description,
            enabled: flag.enabled,
            rollout_percentage: flag.rollout_percentage,
            target_tiers: [...flag.target_tiers],
            target_users: flag.target_users.join(', '),
        };
        this.editingFlagId.set(flag.id);
        this.dialogMode.set('edit');
    }

    closeDialog(): void {
        this.dialogMode.set(null);
    }

    saveFlag(): void {
        this.saving.set(true);
        const payload = {
            flag_name: this.formData.flag_name,
            description: this.formData.description,
            enabled: this.formData.enabled,
            rollout_percentage: this.formData.rollout_percentage,
            target_tiers: this.formData.target_tiers,
            target_users: this.formData.target_users
                .split(',')
                .map(s => s.trim())
                .filter(Boolean),
        };

        const request = this.dialogMode() === 'create'
            ? this.http.post('/admin/config/feature-flags', payload)
            : this.http.patch(`/admin/config/feature-flags/${this.editingFlagId()}`, payload);

        request.subscribe({
            next: () => {
                this.snackBar.open(
                    this.dialogMode() === 'create' ? 'Flag created' : 'Flag updated',
                    'OK', { duration: 3000 },
                );
                this.saving.set(false);
                this.closeDialog();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to save flag', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    openDeleteConfirm(flag: FeatureFlag): void {
        this.deletingFlag.set(flag);
    }

    closeDeleteConfirm(): void {
        this.deletingFlag.set(null);
    }

    confirmDelete(): void {
        const flag = this.deletingFlag();
        if (!flag) return;

        this.saving.set(true);
        this.http.delete(`/admin/config/feature-flags/${flag.id}`).subscribe({
            next: () => {
                this.snackBar.open(`Flag "${flag.flag_name}" deleted`, 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeDeleteConfirm();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to delete flag', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    private emptyForm(): FlagFormData {
        return {
            flag_name: '',
            description: '',
            enabled: false,
            rollout_percentage: 100,
            target_tiers: [],
            target_users: '',
        };
    }
}
