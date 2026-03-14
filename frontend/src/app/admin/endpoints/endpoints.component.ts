/**
 * EndpointsComponent — Endpoint auth configuration editor.
 *
 * Loads the static endpoint registry from assets and displays each endpoint
 * in a filterable Material table. Admin users can override the authentication
 * requirements (tier, scopes, public access) per endpoint via a dialog.
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
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface RegistryEndpoint {
    readonly path: string;
    readonly method: string;
    readonly operationId: string;
    readonly summary: string;
    readonly description: string;
    readonly tags: string[];
    readonly security: string[];
    readonly parameterCount: number;
    readonly hasRequestBody: boolean;
}

interface EndpointRegistry {
    readonly generatedAt: string;
    readonly specVersion: string;
    readonly endpoints: RegistryEndpoint[];
}

interface EndpointOverride {
    required_tier: string;
    required_scopes: string[];
    is_public: boolean;
}

@Component({
    selector: 'app-admin-endpoints',
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
        MatChipsModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatCheckboxModule,
        MatSnackBarModule,
    ],
    template: `
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">api</mat-icon>
            <mat-card-title>Endpoint Auth</mat-card-title>
            <mat-card-subtitle>{{ totalEndpoints() }} endpoints loaded from registry</mat-card-subtitle>
        </mat-card-header>
    </mat-card>

    <!-- Filters -->
    <mat-card appearance="outlined" class="mb-2">
        <mat-card-content>
            <div class="filters">
                <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Search path</mat-label>
                    <input matInput [(ngModel)]="filterPath" (ngModelChange)="applyFilters()" placeholder="/admin/..." />
                    <mat-icon matSuffix aria-hidden="true">search</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Tag</mat-label>
                    <mat-select [(ngModel)]="filterTag" (ngModelChange)="applyFilters()">
                        <mat-option value="">All</mat-option>
                        @for (t of availableTags(); track t) {
                            <mat-option [value]="t">{{ t }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field-sm">
                    <mat-label>Method</mat-label>
                    <mat-select [(ngModel)]="filterMethod" (ngModelChange)="applyFilters()">
                        <mat-option value="">All</mat-option>
                        @for (m of methods; track m) {
                            <mat-option [value]="m">{{ m }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
            </div>
        </mat-card-content>
    </mat-card>

    <!-- Results -->
    <mat-card appearance="outlined">
        <mat-card-content>
            @if (loading()) {
                <div class="loading-container">
                    <mat-progress-spinner diameter="40" mode="indeterminate" />
                </div>
            } @else if (filteredEndpoints().length === 0) {
                <p class="empty-state">No endpoints match the current filters.</p>
            } @else {
                <table mat-table [dataSource]="filteredEndpoints()" class="endpoints-table">
                    <ng-container matColumnDef="method">
                        <th mat-header-cell *matHeaderCellDef>Method</th>
                        <td mat-cell *matCellDef="let row">
                            <span class="method-chip" [class]="'method-' + row.method.toLowerCase()">{{ row.method }}</span>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="path">
                        <th mat-header-cell *matHeaderCellDef>Path</th>
                        <td mat-cell *matCellDef="let row">
                            <code class="endpoint-path" [matTooltip]="row.summary">{{ row.path }}</code>
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="tag">
                        <th mat-header-cell *matHeaderCellDef>Tag</th>
                        <td mat-cell *matCellDef="let row">{{ row.tags[0] || '—' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="security">
                        <th mat-header-cell *matHeaderCellDef>Security</th>
                        <td mat-cell *matCellDef="let row">
                            @for (s of row.security; track s) {
                                <span class="security-chip">{{ s }}</span>
                            } @empty {
                                <span class="text-muted">Public</span>
                            }
                        </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef>Override</th>
                        <td mat-cell *matCellDef="let row">
                            <button mat-icon-button matTooltip="Edit auth override"
                                (click)="openOverride(row)">
                                <mat-icon aria-hidden="true">edit</mat-icon>
                            </button>
                        </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>
            }
        </mat-card-content>
    </mat-card>

    <!-- Inline override editor (replaces MatDialog to avoid the dependency) -->
    @if (editingEndpoint()) {
        <div class="overlay" (click)="closeOverride()" (keydown.enter)="closeOverride()" tabindex="0" role="button">
            <mat-card appearance="outlined" class="override-dialog" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" role="dialog">
                <mat-card-header>
                    <mat-icon mat-card-avatar aria-hidden="true">tune</mat-icon>
                    <mat-card-title>Override: {{ editingEndpoint()!.method }} {{ editingEndpoint()!.path }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="override-form">
                        <mat-form-field appearance="outline" class="full-width">
                            <mat-label>Required Tier</mat-label>
                            <mat-select [(ngModel)]="overrideTier">
                                <mat-option value="">None</mat-option>
                                @for (t of tiers; track t) {
                                    <mat-option [value]="t">{{ t }}</mat-option>
                                }
                            </mat-select>
                        </mat-form-field>

                        <div class="scope-toggles">
                            <span class="scope-label">Scopes:</span>
                            @for (s of availableScopes; track s) {
                                <mat-checkbox [checked]="overrideScopes.includes(s)"
                                    (change)="toggleScope(s)">{{ s }}</mat-checkbox>
                            }
                        </div>

                        <mat-checkbox [(ngModel)]="overridePublic">Public (no auth required)</mat-checkbox>
                    </div>
                </mat-card-content>
                <mat-card-actions align="end">
                    <button mat-button (click)="closeOverride()">Cancel</button>
                    <button mat-flat-button color="primary" (click)="saveOverride()" [disabled]="savingOverride()">
                        @if (savingOverride()) {
                            <mat-progress-spinner diameter="18" mode="indeterminate" />
                        } @else {
                            Save Override
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        </div>
    }
    `,
    styles: [`
    .mb-2 { margin-bottom: 16px; }
    .filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
    .filter-field { flex: 1; min-width: 200px; }
    .filter-field-sm { min-width: 140px; }
    .loading-container { display: flex; justify-content: center; padding: 32px; }
    .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px; }
    .endpoints-table { width: 100%; }
    .method-chip {
        display: inline-block; padding: 2px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
    }
    .method-get { background: #e3f2fd; color: #1565c0; }
    .method-post { background: #e8f5e9; color: #2e7d32; }
    .method-put { background: #fff3e0; color: #ef6c00; }
    .method-patch { background: #f3e5f5; color: #7b1fa2; }
    .method-delete { background: #fce4ec; color: #c62828; }
    .endpoint-path {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
    }
    .security-chip {
        display: inline-block; padding: 1px 6px; border-radius: 8px;
        font-size: 11px; margin-right: 4px;
        background: var(--mat-sys-surface-variant); color: var(--mat-sys-on-surface-variant);
    }
    .text-muted { color: var(--mat-sys-on-surface-variant); font-size: 12px; }
    .overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .override-dialog { width: 480px; max-width: 90vw; }
    .override-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .full-width { width: 100%; }
    .scope-toggles { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .scope-label { font-size: 14px; font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    `],
})
export class EndpointsComponent {
    private readonly http = inject(HttpClient);
    private readonly snackBar = inject(MatSnackBar);

    readonly allEndpoints = signal<RegistryEndpoint[]>([]);
    readonly loading = signal(false);
    readonly totalEndpoints = computed(() => this.allEndpoints().length);

    readonly displayedColumns = ['method', 'path', 'tag', 'security', 'actions'];
    readonly methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    readonly tiers = ['free', 'starter', 'pro', 'enterprise', 'internal'];
    readonly availableScopes = ['compile', 'rules', 'admin', 'metrics', 'queue'];

    filterPath = '';
    filterTag = '';
    filterMethod = '';

    readonly availableTags = computed(() => {
        const tags = new Set<string>();
        for (const ep of this.allEndpoints()) {
            for (const t of ep.tags) tags.add(t);
        }
        return [...tags].sort();
    });

    readonly filteredEndpoints = computed(() => {
        let endpoints = this.allEndpoints();
        if (this.filterPath) {
            const lower = this.filterPath.toLowerCase();
            endpoints = endpoints.filter(e => e.path.toLowerCase().includes(lower));
        }
        if (this.filterTag) {
            endpoints = endpoints.filter(e => e.tags.includes(this.filterTag));
        }
        if (this.filterMethod) {
            endpoints = endpoints.filter(e => e.method === this.filterMethod);
        }
        return endpoints;
    });

    // Override editor state
    readonly editingEndpoint = signal<RegistryEndpoint | null>(null);
    readonly savingOverride = signal(false);
    overrideTier = '';
    overrideScopes: string[] = [];
    overridePublic = false;

    private readonly _init = afterNextRender(() => this.loadData());

    loadData(): void {
        this.loading.set(true);
        this.http.get<EndpointRegistry>('/assets/endpoint-registry.json').subscribe({
            next: (registry) => {
                this.allEndpoints.set(registry.endpoints ?? []);
                this.loading.set(false);
            },
            error: () => {
                this.allEndpoints.set([]);
                this.loading.set(false);
            },
        });
    }

    applyFilters(): void {
        // Computed signals react automatically — this forces change detection via signal reads
    }

    openOverride(endpoint: RegistryEndpoint): void {
        this.editingEndpoint.set(endpoint);
        this.overrideTier = '';
        this.overrideScopes = [];
        this.overridePublic = false;
    }

    closeOverride(): void {
        this.editingEndpoint.set(null);
    }

    toggleScope(scope: string): void {
        if (this.overrideScopes.includes(scope)) {
            this.overrideScopes = this.overrideScopes.filter(s => s !== scope);
        } else {
            this.overrideScopes = [...this.overrideScopes, scope];
        }
    }

    saveOverride(): void {
        const endpoint = this.editingEndpoint();
        if (!endpoint) return;

        this.savingOverride.set(true);
        const body: EndpointOverride & { path: string; method: string } = {
            path: endpoint.path,
            method: endpoint.method,
            required_tier: this.overrideTier,
            required_scopes: this.overrideScopes,
            is_public: this.overridePublic,
        };

        this.http.post('/admin/config/endpoints/override', body).subscribe({
            next: () => {
                this.snackBar.open('Override saved successfully', 'OK', { duration: 3000 });
                this.savingOverride.set(false);
                this.closeOverride();
            },
            error: () => {
                this.snackBar.open('Failed to save override', 'Dismiss', { duration: 5000 });
                this.savingOverride.set(false);
            },
        });
    }
}
