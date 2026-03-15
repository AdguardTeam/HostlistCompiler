/**
 * RolesComponent — Roles & permissions management panel.
 *
 * Two-column layout: role list on the left, permission details and
 * assignment table on the right. Supports CRUD for roles and
 * user ↔ role assignment management.
 */

import {
    Component, afterNextRender, inject, signal,
    ChangeDetectionStrategy,
    DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface AdminRole {
    readonly id: number;
    readonly role_name: string;
    readonly display_name: string;
    readonly description: string;
    readonly permissions: string[];
    readonly is_active: boolean;
    readonly created_at: string;
    readonly updated_at: string;
}

interface RoleListResponse {
    readonly success: boolean;
    readonly items: AdminRole[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

interface RoleAssignment {
    readonly id: number;
    readonly clerk_user_id: string;
    readonly role_name: string;
    readonly assigned_by: string;
    readonly assigned_at: string;
    readonly expires_at: string | null;
}

interface RoleAssignmentListResponse {
    readonly success: boolean;
    readonly items: RoleAssignment[];
    readonly total: number;
}

interface RoleFormData {
    role_name: string;
    display_name: string;
    description: string;
    permissions: string[];
}

@Component({
    selector: 'app-admin-roles',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatTableModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatDividerModule,
        MatChipsModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">admin_panel_settings</mat-icon>
            <mat-card-title>Roles &amp; Permissions</mat-card-title>
            <mat-card-subtitle>{{ roles().length }} roles configured</mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
            <button mat-flat-button color="primary" (click)="openCreateDialog()">
                <mat-icon aria-hidden="true">add</mat-icon> Create Role
            </button>
        </mat-card-actions>
    </mat-card>

    @if (loading()) {
        <div class="loading-container">
            <mat-progress-spinner diameter="40" mode="indeterminate" />
        </div>
    } @else {
        <div class="two-column">
            <!-- Left: Role list -->
            <mat-card appearance="outlined" class="role-list-card">
                <mat-card-content>
                    <mat-nav-list>
                        @for (role of roles(); track role.id) {
                            <a mat-list-item
                                [class.selected-role]="selectedRole()?.id === role.id"
                                (click)="selectRole(role)"
                                (keydown.enter)="selectRole(role)"
                                tabindex="0"
                                role="button">
                                <mat-icon matListItemIcon aria-hidden="true">
                                    {{ role.role_name === 'super_admin' ? 'shield' : role.role_name === 'admin' ? 'admin_panel_settings' : 'person' }}
                                </mat-icon>
                                <span matListItemTitle>{{ role.display_name }}</span>
                                <span matListItemLine class="text-muted">{{ role.permissions.length }} permissions</span>
                            </a>
                        } @empty {
                            <p class="empty-state">No roles configured.</p>
                        }
                    </mat-nav-list>
                </mat-card-content>
            </mat-card>

            <!-- Right: Role details -->
            <div class="role-details">
                @if (selectedRole()) {
                    <mat-card appearance="outlined" class="mb-2">
                        <mat-card-header>
                            <mat-icon mat-card-avatar aria-hidden="true">security</mat-icon>
                            <mat-card-title>{{ selectedRole()!.display_name }}</mat-card-title>
                            <mat-card-subtitle>{{ selectedRole()!.description }}</mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-actions>
                            <button mat-stroked-button (click)="openEditDialog(selectedRole()!)">
                                <mat-icon aria-hidden="true">edit</mat-icon> Edit
                            </button>
                        </mat-card-actions>
                        <mat-card-content>
                            <h4 class="section-title">Permissions</h4>
                            <div class="permission-grid">
                                @for (perm of allPermissions; track perm) {
                                    <div class="perm-item">
                                        <mat-icon [class.perm-active]="selectedRole()!.permissions.includes(perm)"
                                            [class.perm-inactive]="!selectedRole()!.permissions.includes(perm)"
                                            aria-hidden="true">
                                            {{ selectedRole()!.permissions.includes(perm) ? 'check_circle' : 'radio_button_unchecked' }}
                                        </mat-icon>
                                        <code class="perm-name">{{ perm }}</code>
                                    </div>
                                }
                            </div>
                        </mat-card-content>
                    </mat-card>

                    <!-- Assignments for selected role -->
                    <mat-card appearance="outlined">
                        <mat-card-header>
                            <mat-icon mat-card-avatar aria-hidden="true">group</mat-icon>
                            <mat-card-title>Assigned Users</mat-card-title>
                            <mat-card-subtitle>{{ roleAssignments().length }} users with this role</mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-actions>
                            <button mat-stroked-button (click)="openAssignDialog()">
                                <mat-icon aria-hidden="true">person_add</mat-icon> Assign User
                            </button>
                        </mat-card-actions>
                        <mat-card-content>
                            @if (roleAssignments().length === 0) {
                                <p class="empty-state">No users assigned to this role.</p>
                            } @else {
                                <table mat-table [dataSource]="roleAssignments()" class="assign-table">
                                    <ng-container matColumnDef="clerk_user_id">
                                        <th mat-header-cell *matHeaderCellDef>User ID</th>
                                        <td mat-cell *matCellDef="let row">
                                            <code class="resource-id">{{ row.clerk_user_id }}</code>
                                        </td>
                                    </ng-container>

                                    <ng-container matColumnDef="assigned_by">
                                        <th mat-header-cell *matHeaderCellDef>Assigned By</th>
                                        <td mat-cell *matCellDef="let row">{{ row.assigned_by }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="assigned_at">
                                        <th mat-header-cell *matHeaderCellDef>Date</th>
                                        <td mat-cell *matCellDef="let row">{{ row.assigned_at | date:'mediumDate' }}</td>
                                    </ng-container>

                                    <ng-container matColumnDef="actions">
                                        <th mat-header-cell *matHeaderCellDef></th>
                                        <td mat-cell *matCellDef="let row">
                                            <button mat-icon-button color="warn" matTooltip="Revoke"
                                                (click)="revokeAssignment(row)">
                                                <mat-icon aria-hidden="true">remove_circle</mat-icon>
                                            </button>
                                        </td>
                                    </ng-container>

                                    <tr mat-header-row *matHeaderRowDef="assignmentColumns"></tr>
                                    <tr mat-row *matRowDef="let row; columns: assignmentColumns;"></tr>
                                </table>
                            }
                        </mat-card-content>
                    </mat-card>
                } @else {
                    <mat-card appearance="outlined">
                        <mat-card-content>
                            <p class="empty-state">Select a role to view details and assignments.</p>
                        </mat-card-content>
                    </mat-card>
                }
            </div>
        </div>
    }

    <!-- Create / Edit Role Dialog -->
    @if (dialogMode()) {
        <div class="overlay" (click)="closeDialog()" (keydown.enter)="closeDialog()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">{{ dialogMode() === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
                    <mat-card-title>{{ dialogMode() === 'create' ? 'Create Role' : 'Edit Role' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="dialog-form">
                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Role Name</mat-label>
                            <input matInput [(ngModel)]="formData.role_name" placeholder="e.g. moderator"
                                [disabled]="dialogMode() === 'edit'" />
                            <mat-hint>Unique identifier (snake_case)</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Display Name</mat-label>
                            <input matInput [(ngModel)]="formData.display_name" placeholder="Moderator" />
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Description</mat-label>
                            <textarea matInput [(ngModel)]="formData.description" rows="2"></textarea>
                        </mat-form-field>

                        <h4 class="section-title">Permissions</h4>
                        <div class="permission-grid">
                            @for (perm of allPermissions; track perm) {
                                <mat-checkbox
                                    [checked]="formData.permissions.includes(perm)"
                                    (change)="togglePermission(perm, $event.checked)">
                                    <code>{{ perm }}</code>
                                </mat-checkbox>
                            }
                        </div>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeDialog()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveRole()" [disabled]="saving()">
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

    <!-- Assign User Dialog -->
    @if (showAssignDialog()) {
        <div class="overlay" (click)="closeAssignDialog()" (keydown.enter)="closeAssignDialog()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">person_add</mat-icon>
                    <mat-card-title>Assign User to {{ selectedRole()!.display_name }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Clerk User ID</mat-label>
                        <input matInput [(ngModel)]="assignUserId" placeholder="user_xxxx" />
                    </mat-form-field>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeAssignDialog()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="confirmAssign()" [disabled]="saving()">
                        @if (saving()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            Assign
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        </div>
    }
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .loading-container { display: flex; justify-content: center; padding: 48px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 24px; }
    .text-muted { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .full-width { width: 100%; }

    .two-column { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
    @media (max-width: 768px) { .two-column { grid-template-columns: 1fr; } }

    .role-list-card { min-height: 300px; }
    .selected-role { background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent) !important; }

    .section-title {
        font-size: 13px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.05em; color: var(--mat-sys-on-surface-variant);
        margin: 16px 0 8px;
    }

    .permission-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 6px;
    }
    .perm-item { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
    .perm-name {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }
    .perm-active { color: var(--mat-sys-primary); font-size: 18px; }
    .perm-inactive { color: var(--mat-sys-on-surface-variant); font-size: 18px; opacity: 0.4; }

    .assign-table { width: 100%; }
    .resource-id {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        background: var(--mat-sys-surface-container); padding: 2px 6px;
        border-radius: 4px;
    }

    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .dialog-card { width: 560px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
    .dialog-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    `],
})
export class RolesComponent {
    private readonly http = inject(HttpClient);
    private readonly destroyRef = inject(DestroyRef);
    private readonly snackBar = inject(MatSnackBar);

    readonly roles = signal<AdminRole[]>([]);
    readonly selectedRole = signal<AdminRole | null>(null);
    readonly roleAssignments = signal<RoleAssignment[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly dialogMode = signal<'create' | 'edit' | null>(null);
    readonly showAssignDialog = signal(false);

    readonly assignmentColumns = ['clerk_user_id', 'assigned_by', 'assigned_at', 'actions'];

    readonly allPermissions = [
        'admin:users:read', 'admin:users:write',
        'admin:roles:read', 'admin:roles:write',
        'admin:tiers:read', 'admin:tiers:write',
        'admin:scopes:read', 'admin:scopes:write',
        'admin:endpoints:read', 'admin:endpoints:write',
        'admin:flags:read', 'admin:flags:write',
        'admin:api-keys:read', 'admin:api-keys:write',
        'admin:audit:read',
        'admin:announcements:read', 'admin:announcements:write',
        'admin:storage:read', 'admin:storage:write',
        'admin:webhooks:read', 'admin:webhooks:write',
        'admin:observability:read',
    ];

    formData: RoleFormData = this.emptyForm();
    assignUserId = '';

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<RoleListResponse>('/admin/roles').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (res) => {
                this.roles.set(res.items ?? []);
                this.loading.set(false);
                // Re-select if previously selected
                const prev = this.selectedRole();
                if (prev) {
                    const refreshed = (res.items ?? []).find(r => r.id === prev.id);
                    this.selectedRole.set(refreshed ?? null);
                    if (refreshed) this.loadAssignments(refreshed.role_name);
                }
            },
            error: () => {
                this.roles.set([]);
                this.loading.set(false);
            },
        });
    }

    selectRole(role: AdminRole): void {
        this.selectedRole.set(role);
        this.loadAssignments(role.role_name);
    }

    loadAssignments(roleName: string): void {
        this.http.get<RoleAssignmentListResponse>('/admin/roles/assignments', {
            params: { role_name: roleName },
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (res) => this.roleAssignments.set(res.items ?? []),
            error: () => this.roleAssignments.set([]),
        });
    }

    openCreateDialog(): void {
        this.formData = this.emptyForm();
        this.dialogMode.set('create');
    }

    openEditDialog(role: AdminRole): void {
        this.formData = {
            role_name: role.role_name,
            display_name: role.display_name,
            description: role.description,
            permissions: [...role.permissions],
        };
        this.dialogMode.set('edit');
    }

    closeDialog(): void {
        this.dialogMode.set(null);
    }

    togglePermission(perm: string, checked: boolean): void {
        if (checked) {
            if (!this.formData.permissions.includes(perm)) {
                this.formData.permissions = [...this.formData.permissions, perm];
            }
        } else {
            this.formData.permissions = this.formData.permissions.filter(p => p !== perm);
        }
    }

    saveRole(): void {
        this.saving.set(true);
        const payload = {
            role_name: this.formData.role_name,
            display_name: this.formData.display_name,
            description: this.formData.description,
            permissions: this.formData.permissions,
        };

        const request = this.dialogMode() === 'create'
            ? this.http.post('/admin/roles', payload)
            : this.http.patch(`/admin/roles/${this.formData.role_name}`, payload);

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.snackBar.open(
                    this.dialogMode() === 'create' ? 'Role created' : 'Role updated',
                    'OK', { duration: 3000 },
                );
                this.saving.set(false);
                this.closeDialog();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to save role', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    openAssignDialog(): void {
        this.assignUserId = '';
        this.showAssignDialog.set(true);
    }

    closeAssignDialog(): void {
        this.showAssignDialog.set(false);
    }

    confirmAssign(): void {
        const role = this.selectedRole();
        if (!role || !this.assignUserId.trim()) return;

        this.saving.set(true);
        this.http.post('/admin/roles/assignments', {
            clerk_user_id: this.assignUserId.trim(),
            role_name: role.role_name,
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.snackBar.open('User assigned to role', 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeAssignDialog();
                this.loadAssignments(role.role_name);
            },
            error: () => {
                this.snackBar.open('Failed to assign user', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    revokeAssignment(assignment: RoleAssignment): void {
        this.saving.set(true);
        this.http.delete(`/admin/roles/assignments/${assignment.clerk_user_id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.snackBar.open('Assignment revoked', 'OK', { duration: 3000 });
                this.saving.set(false);
                const role = this.selectedRole();
                if (role) this.loadAssignments(role.role_name);
            },
            error: () => {
                this.snackBar.open('Failed to revoke assignment', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    private emptyForm(): RoleFormData {
        return {
            role_name: '',
            display_name: '',
            description: '',
            permissions: [],
        };
    }
}
