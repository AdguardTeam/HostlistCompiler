/**
 * AnnouncementsComponent — Announcement manager.
 *
 * Provides a table of announcements with severity chips, active toggles,
 * creation/edit dialogs, delete confirmation, and a live preview section.
 * Uses signal-based state and calls the admin announcements REST API.
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface Announcement {
    readonly id: number;
    readonly title: string;
    readonly body: string;
    readonly severity: 'info' | 'warning' | 'error' | 'success';
    readonly active_from: string | null;
    readonly active_until: string | null;
    readonly is_active: boolean;
    readonly created_by: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}

interface AnnouncementListResponse {
    readonly success: boolean;
    readonly items: Announcement[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

interface AnnouncementFormData {
    title: string;
    body: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    is_active: boolean;
    active_from: string;
    active_until: string;
}

@Component({
    selector: 'app-admin-announcements',
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
        MatTooltipModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">campaign</mat-icon>
            <mat-card-title>Announcements</mat-card-title>
            <mat-card-subtitle>{{ announcements().length }} announcements</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-flat-button color="primary" (click)="openCreateDialog()">
                <mat-icon aria-hidden="true">add</mat-icon> Create Announcement
            </button>
        </mat-card-actions>
    </mat-card>

    <!-- Announcements table -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (announcements().length === 0) {
                <p class="empty-state">No announcements yet. Create one to notify users.</p>
            } @else {
                <table mat-table [dataSource]="announcements()" class="announcements-table">
                    <ng-container matColumnDef="title">
                        <th mat-header-cell *matHeaderCellDef>Title</th>
                        <td mat-cell *matCellDef="let row">
                            <strong>{{ row.title }}</strong>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="body">
                        <th mat-header-cell *matHeaderCellDef>Content</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="body-text">{{ row.body }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="severity">
                        <th mat-header-cell *matHeaderCellDef>Type</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="severity-chip" [class]="'sev-' + row.severity">
                                {{ row.severity }}
                            </span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="is_active">
                        <th mat-header-cell *matHeaderCellDef>Active</th>
                        <td mat-cell *matCellDef="let row">
                            <mat-slide-toggle
                                [checked]="row.is_active"
                                (change)="toggleActive(row, $event.checked)"
                                [matTooltip]="row.is_active ? 'Click to deactivate' : 'Click to activate'"
                            />
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="active_from">
                        <th mat-header-cell *matHeaderCellDef>Start</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="date-text">{{ row.active_from || 'Immediate' }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="active_until">
                        <th mat-header-cell *matHeaderCellDef>End</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="date-text">{{ row.active_until || 'No end' }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="Edit" (click)="openEditDialog(row)">
                                <mat-icon aria-hidden="true">edit</mat-icon>
                            </button>
                            <button mat-icon-button color="warn" matTooltip="Delete" (click)="openDeleteConfirm(row)">
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
            <mat-card appearance="outlined" class="ann-dialog" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">{{ dialogMode() === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
                    <mat-card-title>{{ dialogMode() === 'create' ? 'Create Announcement' : 'Edit Announcement' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="dialog-form">
                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Title</mat-label>
                            <input matInput [(ngModel)]="formData.title" placeholder="e.g. Scheduled Maintenance" />
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Content</mat-label>
                            <textarea matInput [(ngModel)]="formData.body" rows="3"
                                placeholder="Announcement body text..."></textarea>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Severity</mat-label>
                            <mat-select [(ngModel)]="formData.severity">
                                @for (s of severities; track s) {
                                    <mat-option [value]="s">{{ s }}</mat-option>
                                }
                            </mat-select>
                        </mat-form-field>

                        <mat-slide-toggle [(ngModel)]="formData.is_active">Active</mat-slide-toggle>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Start Date</mat-label>
                            <input matInput type="date" [(ngModel)]="formData.active_from" />
                            <mat-hint>Leave empty for immediate</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>End Date</mat-label>
                            <input matInput type="date" [(ngModel)]="formData.active_until" />
                            <mat-hint>Leave empty for no end date</mat-hint>
                        </mat-form-field>

                        <!-- Live preview -->
                        <div class="preview-section">
                            <div class="preview-label">Preview</div>
                            <div class="preview-banner" [class]="'preview-' + formData.severity">
                                <mat-icon aria-hidden="true" class="preview-icon">{{ severityIcon(formData.severity) }}</mat-icon>
                                <div class="preview-text">
                                    <strong>{{ formData.title || 'Untitled' }}</strong>
                                    <span>{{ formData.body || 'No content' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDialog()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveAnnouncement()" [disabled]="saving()">
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
    @if (deletingAnnouncement()) {
        <div class="overlay" (click)="closeDeleteConfirm()" (keydown.enter)="closeDeleteConfirm()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="ann-dialog" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-error)" aria-hidden="true">warning</mat-icon>
                    <mat-card-title>Delete Announcement</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <p>Are you sure you want to delete <strong>{{ deletingAnnouncement()!.title }}</strong>?</p>
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
    .announcements-table { width: 100%; }
    .body-text { font-size: 13px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .severity-chip {
        display: inline-block; padding: 2px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 600; text-transform: capitalize;
    }
    .sev-info { background: #e3f2fd; color: #1565c0; }
    .sev-warning { background: #fff3e0; color: #ef6c00; }
    .sev-error { background: #fce4ec; color: #c62828; }
    .sev-success { background: #e8f5e9; color: #2e7d32; }
    .date-text { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .ann-dialog { width: 560px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
    .dialog-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .full-width { width: 100%; }

    /* Preview */
    .preview-section { border-top: 1px solid var(--mat-sys-outline-variant); padding-top: 12px; }
    .preview-label { font-size: 12px; font-weight: 500; color: var(--mat-sys-on-surface-variant); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    .preview-banner {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 12px 16px; border-radius: 8px; border-left: 4px solid;
    }
    .preview-info { background: #e3f2fd; border-color: #1565c0; }
    .preview-warning { background: #fff3e0; border-color: #ef6c00; }
    .preview-error { background: #fce4ec; border-color: #c62828; }
    .preview-success { background: #e8f5e9; border-color: #2e7d32; }
    .preview-icon { margin-top: 2px; }
    .preview-text { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    `],
})
export class AnnouncementsComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly announcements = signal<Announcement[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly dialogMode = signal<'create' | 'edit' | null>(null);
    readonly editingId = signal<number | null>(null);
    readonly deletingAnnouncement = signal<Announcement | null>(null);

    readonly displayedColumns = ['title', 'body', 'severity', 'is_active', 'active_from', 'active_until', 'actions'];
    readonly severities: Array<'info' | 'warning' | 'error' | 'success'> = ['info', 'warning', 'error', 'success'];

    formData: AnnouncementFormData = this.emptyForm();

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<AnnouncementListResponse>('/admin/announcements').subscribe({
            next: (res) => {
                this.announcements.set(res.items ?? []);
                this.loading.set(false);
            },
            error: () => {
                this.announcements.set([]);
                this.loading.set(false);
            },
        });
    }

    toggleActive(ann: Announcement, is_active: boolean): void {
        this.http.patch(`/admin/announcements/${ann.id}`, { is_active }).subscribe({
            next: () => {
                this.announcements.update(items =>
                    items.map(a => a.id === ann.id ? { ...a, is_active } : a),
                );
                this.snackBar.open(
                    `"${ann.title}" ${is_active ? 'activated' : 'deactivated'}`,
                    'OK', { duration: 2000 },
                );
            },
            error: () => {
                this.snackBar.open('Failed to update announcement', 'Dismiss', { duration: 3000 });
            },
        });
    }

    openCreateDialog(): void {
        this.formData = this.emptyForm();
        this.editingId.set(null);
        this.dialogMode.set('create');
    }

    openEditDialog(ann: Announcement): void {
        this.formData = {
            title: ann.title,
            body: ann.body,
            severity: ann.severity,
            is_active: ann.is_active,
            active_from: ann.active_from ?? '',
            active_until: ann.active_until ?? '',
        };
        this.editingId.set(ann.id);
        this.dialogMode.set('edit');
    }

    closeDialog(): void {
        this.dialogMode.set(null);
    }

    saveAnnouncement(): void {
        this.saving.set(true);
        const payload = {
            title: this.formData.title,
            body: this.formData.body,
            severity: this.formData.severity,
            is_active: this.formData.is_active,
            active_from: this.formData.active_from || null,
            active_until: this.formData.active_until || null,
        };

        const request = this.dialogMode() === 'create'
            ? this.http.post('/admin/announcements', payload)
            : this.http.patch(`/admin/announcements/${this.editingId()}`, payload);

        request.subscribe({
            next: () => {
                this.snackBar.open(
                    this.dialogMode() === 'create' ? 'Announcement created' : 'Announcement updated',
                    'OK', { duration: 3000 },
                );
                this.saving.set(false);
                this.closeDialog();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to save announcement', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    openDeleteConfirm(ann: Announcement): void {
        this.deletingAnnouncement.set(ann);
    }

    closeDeleteConfirm(): void {
        this.deletingAnnouncement.set(null);
    }

    confirmDelete(): void {
        const ann = this.deletingAnnouncement();
        if (!ann) return;

        this.saving.set(true);
        this.http.delete(`/admin/announcements/${ann.id}`).subscribe({
            next: () => {
                this.snackBar.open(`"${ann.title}" deleted`, 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeDeleteConfirm();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to delete announcement', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    severityIcon(severity: string): string {
        switch (severity) {
            case 'info': return 'info';
            case 'warning': return 'warning';
            case 'error': return 'error';
            case 'success': return 'check_circle';
            default: return 'info';
        }
    }

    private emptyForm(): AnnouncementFormData {
        return {
            title: '',
            body: '',
            severity: 'info',
            is_active: true,
            active_from: '',
            active_until: '',
        };
    }
}
