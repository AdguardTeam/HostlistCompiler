/**
 * ScopesComponent — Scope registry editor.
 *
 * Provides a table of OAuth scopes with tier badges, creation dialog,
 * edit dialog, and delete confirmation. Uses signal-based state and
 * calls the admin scopes REST API.
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface ScopeConfig {
    readonly id: number;
    readonly scope_name: string;
    readonly display_name: string;
    readonly description: string;
    readonly required_tier: string;
    readonly is_active: boolean;
    readonly created_at: string;
    readonly updated_at: string;
}

interface ScopeListResponse {
    readonly success: boolean;
    readonly items: ScopeConfig[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

interface ScopeFormData {
    scope_name: string;
    display_name: string;
    description: string;
    required_tier: string;
}

@Component({
    selector: 'app-admin-scopes',
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
        MatTooltipModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">security</mat-icon>
            <mat-card-title>Scope Registry</mat-card-title>
            <mat-card-subtitle>{{ scopes().length }} scopes configured</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-flat-button color="primary" (click)="openCreateDialog()">
                <mat-icon aria-hidden="true">add</mat-icon> Create Scope
            </button>
        </mat-card-actions>
    </mat-card>

    <!-- Scopes table -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (scopes().length === 0) {
                <p class="empty-state">No scopes configured yet. Create one to get started.</p>
            } @else {
                <table mat-table [dataSource]="scopes()" class="scopes-table">
                    <ng-container matColumnDef="scope_name">
                        <th mat-header-cell *matHeaderCellDef>Scope Name</th>
                        <td mat-cell *matCellDef="let row">
                            <code class="scope-name">{{ row.scope_name }}</code>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="display_name">
                        <th mat-header-cell *matHeaderCellDef>Display Name</th>
                        <td mat-cell *matCellDef="let row">{{ row.display_name }}</td>
                    </ng-container>

                    <ng-container matColumnDef="description">
                        <th mat-header-cell *matHeaderCellDef>Description</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="description-text">{{ row.description || '—' }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="required_tier">
                        <th mat-header-cell *matHeaderCellDef>Required Tier</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="tier-badge" [class]="'tier-' + row.required_tier">
                                {{ row.required_tier }}
                            </span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="Edit scope" (click)="openEditDialog(row)">
                                <mat-icon aria-hidden="true">edit</mat-icon>
                            </button>
                            <button mat-icon-button color="warn" matTooltip="Delete scope" (click)="openDeleteConfirm(row)">
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
        <div class="overlay" (click)="closeDialog()" (keydown.enter)="closeDialog()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="scope-dialog" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">{{ dialogMode() === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
                    <mat-card-title>{{ dialogMode() === 'create' ? 'Create Scope' : 'Edit Scope' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="dialog-form">
                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Scope Name</mat-label>
                            <input matInput [(ngModel)]="formData.scope_name" placeholder="e.g. compile:read"
                                [disabled]="dialogMode() === 'edit'" />
                            <mat-hint>Unique identifier (colon-separated)</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Display Name</mat-label>
                            <input matInput [(ngModel)]="formData.display_name" placeholder="e.g. Read Compilations" />
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Description</mat-label>
                            <textarea matInput [(ngModel)]="formData.description" rows="2"
                                placeholder="What does this scope grant access to?"></textarea>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Required Tier</mat-label>
                            <mat-select [(ngModel)]="formData.required_tier">
                                @for (t of allTiers; track t) {
                                    <mat-option [value]="t">{{ t }}</mat-option>
                                }
                            </mat-select>
                            <mat-hint>Minimum tier required for this scope</mat-hint>
                        </mat-form-field>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDialog()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveScope()" [disabled]="saving()">
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
    @if (deletingScope()) {
        <div class="overlay" (click)="closeDeleteConfirm()" (keydown.enter)="closeDeleteConfirm()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="scope-dialog" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-error)" aria-hidden="true">warning</mat-icon>
                    <mat-card-title>Delete Scope</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <p>Are you sure you want to delete <strong>{{ deletingScope()!.scope_name }}</strong>? API keys using this scope will lose access.</p>
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
    .scopes-table { width: 100%; }
    .scope-name {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .description-text { font-size: 13px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .tier-badge {
        display: inline-block; padding: 2px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 600; text-transform: capitalize;
    }
    .tier-free { background: #e0e0e0; color: #424242; }
    .tier-starter { background: #e3f2fd; color: #1565c0; }
    .tier-pro { background: #e8f5e9; color: #2e7d32; }
    .tier-enterprise { background: #f3e5f5; color: #7b1fa2; }
    .tier-internal { background: #fff3e0; color: #ef6c00; }
    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .scope-dialog { width: 520px; max-width: 90vw; }
    .dialog-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .full-width { width: 100%; }
    `],
})
export class ScopesComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly scopes = signal<ScopeConfig[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly dialogMode = signal<'create' | 'edit' | null>(null);
    readonly editingScopeName = signal<string | null>(null);
    readonly deletingScope = signal<ScopeConfig | null>(null);

    readonly displayedColumns = ['scope_name', 'display_name', 'description', 'required_tier', 'actions'];
    readonly allTiers = ['free', 'starter', 'pro', 'enterprise', 'internal'];

    formData: ScopeFormData = this.emptyForm();

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<ScopeListResponse>('/admin/config/scopes').subscribe({
            next: (res) => {
                this.scopes.set(res.items ?? []);
                this.loading.set(false);
            },
            error: () => {
                this.scopes.set([]);
                this.loading.set(false);
            },
        });
    }

    openCreateDialog(): void {
        this.formData = this.emptyForm();
        this.editingScopeName.set(null);
        this.dialogMode.set('create');
    }

    openEditDialog(scope: ScopeConfig): void {
        this.formData = {
            scope_name: scope.scope_name,
            display_name: scope.display_name,
            description: scope.description,
            required_tier: scope.required_tier,
        };
        this.editingScopeName.set(scope.scope_name);
        this.dialogMode.set('edit');
    }

    closeDialog(): void {
        this.dialogMode.set(null);
    }

    saveScope(): void {
        this.saving.set(true);
        const payload = { ...this.formData };

        const request = this.dialogMode() === 'create'
            ? this.http.post('/admin/config/scopes', payload)
            : this.http.patch(`/admin/config/scopes/${this.editingScopeName()}`, payload);

        request.subscribe({
            next: () => {
                this.snackBar.open(
                    this.dialogMode() === 'create' ? 'Scope created' : 'Scope updated',
                    'OK', { duration: 3000 },
                );
                this.saving.set(false);
                this.closeDialog();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to save scope', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    openDeleteConfirm(scope: ScopeConfig): void {
        this.deletingScope.set(scope);
    }

    closeDeleteConfirm(): void {
        this.deletingScope.set(null);
    }

    confirmDelete(): void {
        const scope = this.deletingScope();
        if (!scope) return;

        this.saving.set(true);
        this.http.delete(`/admin/config/scopes/${scope.scope_name}`).subscribe({
            next: () => {
                this.snackBar.open(`Scope "${scope.scope_name}" deleted`, 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeDeleteConfirm();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to delete scope', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    private emptyForm(): ScopeFormData {
        return {
            scope_name: '',
            display_name: '',
            description: '',
            required_tier: 'free',
        };
    }
}
