/**
 * UsersComponent — User management panel.
 *
 * Displays a searchable, filterable table of users with inline actions
 * to change tiers and assign admin roles via overlay dialogs.
 */

import {
    Component, afterNextRender, inject, signal,
    ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface AdminUser {
    readonly clerk_user_id: string;
    readonly email: string;
    readonly display_name: string;
    readonly tier: string;
    readonly admin_role: string | null;
    readonly created_at: string;
    readonly last_sign_in: string | null;
}

interface UserListResponse {
    readonly success: boolean;
    readonly items: AdminUser[];
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

@Component({
    selector: 'app-admin-users',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatChipsModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">people</mat-icon>
            <mat-card-title>User Management</mat-card-title>
            <mat-card-subtitle>{{ totalCount() }} users registered</mat-card-subtitle>
        </mat-card-header>
    </mat-card>

    <!-- Filters -->
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-content>
            <div class="filters">
                <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Search</mat-label>
                    <input matInput [(ngModel)]="searchQuery" placeholder="Email or display name" />
                    <mat-icon matSuffix aria-hidden="true">search</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Tier</mat-label>
                    <mat-select [(ngModel)]="filterTier">
                        <mat-option value="">All</mat-option>
                        @for (t of allTiers; track t) {
                            <mat-option [value]="t">{{ t }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Role</mat-label>
                    <mat-select [(ngModel)]="filterRole">
                        <mat-option value="">All</mat-option>
                        @for (r of allRoles; track r) {
                            <mat-option [value]="r">{{ r }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>

                <div class="filter-actions">
                    <button mat-flat-button color="primary" (click)="applyFilters()">
                        <mat-icon aria-hidden="true">search</mat-icon> Search
                    </button>
                    <button mat-stroked-button (click)="resetFilters()">
                        <mat-icon aria-hidden="true">clear</mat-icon> Reset
                    </button>
                </div>
            </div>
        </mat-card-content>
    </mat-card>

    <!-- Users table -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (users().length === 0) {
                <p class="empty-state">No users found matching the current filters.</p>
            } @else {
                <table mat-table [dataSource]="users()" class="users-table">
                    <ng-container matColumnDef="email">
                        <th mat-header-cell *matHeaderCellDef>Email</th>
                        <td mat-cell *matCellDef="let row">{{ row.email }}</td>
                    </ng-container>

                    <ng-container matColumnDef="display_name">
                        <th mat-header-cell *matHeaderCellDef>Name</th>
                        <td mat-cell *matCellDef="let row">{{ row.display_name || '—' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="tier">
                        <th mat-header-cell *matHeaderCellDef>Tier</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="tier-chip">{{ row.tier }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="admin_role">
                        <th mat-header-cell *matHeaderCellDef>Role</th>
                        <td mat-cell *matCellDef="let row">
                            @if (row.admin_role) {
                                <span class="role-chip">{{ row.admin_role }}</span>
                            } @else {
                                <span class="text-muted">none</span>
                            }
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="created_at">
                        <th mat-header-cell *matHeaderCellDef>Created</th>
                        <td mat-cell *matCellDef="let row">{{ row.created_at | date:'mediumDate' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="last_sign_in">
                        <th mat-header-cell *matHeaderCellDef>Last Sign-In</th>
                        <td mat-cell *matCellDef="let row">{{ row.last_sign_in ? (row.last_sign_in | date:'short') : '—' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="View details" (click)="openDetailOverlay(row)">
                                <mat-icon aria-hidden="true">visibility</mat-icon>
                            </button>
                            <button mat-icon-button matTooltip="Change tier" (click)="openTierOverlay(row)">
                                <mat-icon aria-hidden="true">layers</mat-icon>
                            </button>
                            <button mat-icon-button matTooltip="Assign role" (click)="openRoleOverlay(row)">
                                <mat-icon aria-hidden="true">admin_panel_settings</mat-icon>
                            </button>
                        </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="clickable-row"></tr>
                </table>
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

    <!-- User Detail Overlay -->
    @if (detailUser()) {
        <div class="overlay" (click)="closeOverlays()">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">person</mat-icon>
                    <mat-card-title>{{ detailUser()!.display_name || detailUser()!.email }}</mat-card-title>
                    <mat-card-subtitle>{{ detailUser()!.clerk_user_id }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="detail-grid">
                        <div class="detail-row">
                            <span class="detail-label">Email</span>
                            <span>{{ detailUser()!.email }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Display Name</span>
                            <span>{{ detailUser()!.display_name || '—' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Tier</span>
                            <span class="tier-chip">{{ detailUser()!.tier }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Admin Role</span>
                            <span>{{ detailUser()!.admin_role || 'None' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Created</span>
                            <span>{{ detailUser()!.created_at | date:'medium' }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Sign-In</span>
                            <span>{{ detailUser()!.last_sign_in ? (detailUser()!.last_sign_in | date:'medium') : 'Never' }}</span>
                        </div>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeOverlays()">Close</button>
                </mat-card-actions>
            </mat-card>
        </div>
    }

    <!-- Change Tier Overlay -->
    @if (tierOverlayUser()) {
        <div class="overlay" (click)="closeOverlays()">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">layers</mat-icon>
                    <mat-card-title>Change Tier</mat-card-title>
                    <mat-card-subtitle>{{ tierOverlayUser()!.email }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <mat-form-field appearance="outline" class="full-width">
                        <mat-label>New Tier</mat-label>
                        <mat-select [(ngModel)]="selectedTier">
                            @for (t of allTiers; track t) {
                                <mat-option [value]="t">{{ t }}</mat-option>
                            }
                        </mat-select>
                    </mat-form-field>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeOverlays()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveTier()" [disabled]="saving()">
                        @if (saving()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            Save
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        </div>
    }

    <!-- Assign Role Overlay -->
    @if (roleOverlayUser()) {
        <div class="overlay" (click)="closeOverlays()">
            <mat-card appearance="outlined" class="dialog-card" (click)="$event.stopPropagation()">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">admin_panel_settings</mat-icon>
                    <mat-card-title>Assign Admin Role</mat-card-title>
                    <mat-card-subtitle>{{ roleOverlayUser()!.email }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Role</mat-label>
                        <mat-select [(ngModel)]="selectedRole">
                            <mat-option value="">None (revoke)</mat-option>
                            @for (r of allRoles; track r) {
                                <mat-option [value]="r">{{ r }}</mat-option>
                            }
                        </mat-select>
                    </mat-form-field>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeOverlays()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveRole()" [disabled]="saving()">
                        @if (saving()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            Save
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
    .text-muted { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .full-width { width: 100%; }

    .filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
    .filter-field { flex: 1; min-width: 200px; }
    .filter-field-sm { min-width: 140px; }
    .filter-actions { display: flex; gap: 8px; align-items: center; padding-top: 4px; }

    .users-table { width: 100%; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: var(--mat-sys-surface-variant); }

    .tier-chip {
        display: inline-block; padding: 2px 8px; border-radius: 12px;
        font-size: 12px; font-weight: 600;
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
        color: var(--mat-sys-primary);
    }
    .role-chip {
        display: inline-block; padding: 2px 8px; border-radius: 12px;
        font-size: 12px; font-weight: 600;
        background: color-mix(in srgb, var(--mat-sys-tertiary) 12%, transparent);
        color: var(--mat-sys-tertiary);
    }

    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .dialog-card { width: 480px; max-width: 90vw; }

    .detail-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .detail-row { display: flex; justify-content: space-between; align-items: center; }
    .detail-label { font-weight: 500; color: var(--mat-sys-on-surface-variant); font-size: 13px; }
    `],
})
export class UsersComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly users = signal<AdminUser[]>([]);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly totalCount = signal(0);
    readonly pageIndex = signal(0);

    readonly detailUser = signal<AdminUser | null>(null);
    readonly tierOverlayUser = signal<AdminUser | null>(null);
    readonly roleOverlayUser = signal<AdminUser | null>(null);

    readonly displayedColumns = ['email', 'display_name', 'tier', 'admin_role', 'created_at', 'last_sign_in', 'actions'];
    readonly pageSize = 25;
    readonly allTiers = ['free', 'starter', 'pro', 'enterprise', 'internal'];
    readonly allRoles = ['super_admin', 'admin', 'moderator'];

    searchQuery = '';
    filterTier = '';
    filterRole = '';
    selectedTier = '';
    selectedRole = '';

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        const offset = this.pageIndex() * this.pageSize;

        let params = new HttpParams()
            .set('limit', this.pageSize)
            .set('offset', offset);

        if (this.searchQuery) params = params.set('search', this.searchQuery);
        if (this.filterTier) params = params.set('tier', this.filterTier);
        if (this.filterRole) params = params.set('role', this.filterRole);

        this.http.get<UserListResponse>('/admin/auth/users', { params }).subscribe({
            next: (res) => {
                this.users.set(res.items ?? []);
                this.totalCount.set(res.total ?? 0);
                this.loading.set(false);
            },
            error: () => {
                this.users.set([]);
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
        this.searchQuery = '';
        this.filterTier = '';
        this.filterRole = '';
        this.pageIndex.set(0);
        this.loadData();
    }

    onPage(event: PageEvent): void {
        this.pageIndex.set(event.pageIndex);
        this.loadData();
    }

    openDetailOverlay(user: AdminUser): void {
        this.detailUser.set(user);
    }

    openTierOverlay(user: AdminUser): void {
        this.selectedTier = user.tier;
        this.tierOverlayUser.set(user);
    }

    openRoleOverlay(user: AdminUser): void {
        this.selectedRole = user.admin_role ?? '';
        this.roleOverlayUser.set(user);
    }

    closeOverlays(): void {
        this.detailUser.set(null);
        this.tierOverlayUser.set(null);
        this.roleOverlayUser.set(null);
    }

    saveTier(): void {
        const user = this.tierOverlayUser();
        if (!user) return;

        this.saving.set(true);
        this.http.patch(`/admin/auth/users/${user.clerk_user_id}`, { tier: this.selectedTier }).subscribe({
            next: () => {
                this.snackBar.open(`Tier updated to "${this.selectedTier}"`, 'OK', { duration: 3000 });
                this.saving.set(false);
                this.closeOverlays();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to update tier', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }

    saveRole(): void {
        const user = this.roleOverlayUser();
        if (!user) return;

        this.saving.set(true);

        const request = this.selectedRole
            ? this.http.post('/admin/roles/assignments', {
                clerk_user_id: user.clerk_user_id,
                role_name: this.selectedRole,
            })
            : this.http.delete(`/admin/roles/assignments/${user.clerk_user_id}`);

        request.subscribe({
            next: () => {
                this.snackBar.open(
                    this.selectedRole ? `Role "${this.selectedRole}" assigned` : 'Role revoked',
                    'OK', { duration: 3000 },
                );
                this.saving.set(false);
                this.closeOverlays();
                this.loadData();
            },
            error: () => {
                this.snackBar.open('Failed to update role', 'Dismiss', { duration: 5000 });
                this.saving.set(false);
            },
        });
    }
}
