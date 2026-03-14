/**
 * StorageComponent — Storage administration panel.
 *
 * Migrated from the original monolithic AdminComponent. Provides:
 * - Admin key authentication for the storage backend
 * - Storage statistics (KV keys, R2 objects, D1 tables, cache entries)
 * - Admin actions (clear cache, clear expired, vacuum DB, export data)
 * - Read-only SQL query console with destructive SQL blocking
 * - Virtual scrolling for large result sets
 */

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { EMPTY, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { JsonPipe } from '@angular/common';
import { SkeletonCardComponent } from '../../skeleton/skeleton-card.component';
import { AuthService } from '../../services/auth.service';
import { StorageService, StorageStats, QueryResult } from '../../services/storage.service';

@Component({
    selector: 'app-admin-storage',
    imports: [
        FormsModule,
        JsonPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatDividerModule,
        ScrollingModule,
        SkeletonCardComponent,
    ],
    template: `
    <!-- Auth -->
    @if (!auth.isAuthenticated()) {
        <mat-card appearance="outlined" class="auth-card mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar style="color: var(--mat-sys-tertiary)" aria-hidden="true">lock</mat-icon>
                <mat-card-title>Authentication Required</mat-card-title>
                <mat-card-subtitle>Enter your admin key to access storage management</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <div class="flex items-center gap-3">
                    <mat-form-field appearance="outline" class="auth-field">
                        <mat-label>Admin Key</mat-label>
                        <input matInput type="password" [(ngModel)]="keyInput"
                            (keyup.enter)="authenticate()" placeholder="X-Admin-Key" />
                        <mat-icon matSuffix aria-hidden="true">vpn_key</mat-icon>
                    </mat-form-field>
                    <button mat-raised-button color="primary" (click)="authenticate()">
                        <span><mat-icon aria-hidden="true">login</mat-icon> Authenticate</span>
                    </button>
                </div>
            </mat-card-content>
        </mat-card>
    }

    <!-- Authenticated content -->
    @if (auth.isAuthenticated()) {
        <!-- Status bar -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-content>
                <div class="flex items-center justify-between">
                    <mat-chip-set>
                        <mat-chip highlighted color="primary">
                            <mat-icon aria-hidden="true">check_circle</mat-icon> Authenticated
                        </mat-chip>
                    </mat-chip-set>
                    <button mat-stroked-button color="warn" (click)="auth.clearKey()">
                        <span><mat-icon aria-hidden="true">logout</mat-icon> Logout</span>
                    </button>
                </div>
            </mat-card-content>
        </mat-card>

        <!-- Stats -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar aria-hidden="true">bar_chart</mat-icon>
                <mat-card-title>Storage Stats</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                @if (statsResource.isLoading()) {
                    <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
                        @for (i of [0,1,2,3]; track i) {
                            <app-skeleton-card [lines]="1" [lineWidths]="['60%']" />
                        }
                    </div>
                } @else if (statsResource.value(); as stats) {
                    <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
                        <div class="flex flex-col items-center p-4 rounded-lg bg-surface-variant">
                            <span class="text-stat-lg font-bold">{{ stats.kvKeys }}</span>
                            <span class="text-xs text-on-surface-variant uppercase tracking-wide">KV Keys</span>
                        </div>
                        <div class="flex flex-col items-center p-4 rounded-lg bg-surface-variant">
                            <span class="text-stat-lg font-bold">{{ stats.r2Objects }}</span>
                            <span class="text-xs text-on-surface-variant uppercase tracking-wide">R2 Objects</span>
                        </div>
                        <div class="flex flex-col items-center p-4 rounded-lg bg-surface-variant">
                            <span class="text-stat-lg font-bold">{{ stats.d1Tables }}</span>
                            <span class="text-xs text-on-surface-variant uppercase tracking-wide">D1 Tables</span>
                        </div>
                        <div class="flex flex-col items-center p-4 rounded-lg bg-surface-variant">
                            <span class="text-stat-lg font-bold">{{ stats.cacheEntries }}</span>
                            <span class="text-xs text-on-surface-variant uppercase tracking-wide">Cache Entries</span>
                        </div>
                    </div>
                } @else {
                    <span class="mat-body-2">Failed to load stats</span>
                }
            </mat-card-content>
        </mat-card>

        <!-- Actions -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar aria-hidden="true">settings</mat-icon>
                <mat-card-title>Actions</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <div class="flex gap-3 flex-wrap">
                    <button mat-stroked-button (click)="clearCache()">
                        <span><mat-icon aria-hidden="true">delete_sweep</mat-icon> Clear Cache</span>
                    </button>
                    <button mat-stroked-button (click)="clearExpired()">
                        <span><mat-icon aria-hidden="true">auto_delete</mat-icon> Clear Expired</span>
                    </button>
                    <button mat-stroked-button (click)="vacuum()">
                        <span><mat-icon aria-hidden="true">compress</mat-icon> Vacuum DB</span>
                    </button>
                    <button mat-stroked-button (click)="exportData()">
                        <span><mat-icon aria-hidden="true">download</mat-icon> Export</span>
                    </button>
                </div>
                @if (actionResult()) {
                    <p class="action-result mat-body-2 mt-1">{{ actionResult() }}</p>
                }
            </mat-card-content>
        </mat-card>

        <!-- SQL Query -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar aria-hidden="true">terminal</mat-icon>
                <mat-card-title>SQL Query (Read-only)</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <mat-form-field appearance="outline" class="query-field">
                    <mat-label>SQL</mat-label>
                    <textarea matInput [(ngModel)]="sqlInput" rows="3"
                        placeholder="SELECT * FROM compilations LIMIT 10"
                        (keyup.shift.enter)="runQuery()"
                    ></textarea>
                    <mat-hint>Shift+Enter to execute</mat-hint>
                </mat-form-field>
                @if (sqlWarning()) {
                    <p style="color: var(--mat-sys-error); margin-bottom: 8px;">
                        <mat-icon style="vertical-align: middle; font-size: 18px;" aria-hidden="true">block</mat-icon>
                        {{ sqlWarning() }}
                    </p>
                }
                <button mat-raised-button color="primary" (click)="runQuery()"
                    [disabled]="queryResource.isLoading() || !sqlInput.trim()">
                    @if (queryResource.isLoading()) {
                        <mat-progress-spinner diameter="20" mode="indeterminate" />
                    } @else {
                        <span><mat-icon aria-hidden="true">play_arrow</mat-icon> Execute</span>
                    }
                </button>

                @if (queryResource.value(); as result) {
                    <mat-divider class="mt-2 mb-2"></mat-divider>
                    <mat-chip-set class="mb-1">
                        <mat-chip highlighted color="primary">{{ result.rowCount }} rows</mat-chip>
                        @if (result.duration) {
                            <mat-chip>{{ result.duration }}</mat-chip>
                        }
                    </mat-chip-set>
                    <!-- CDK Virtual Scroll for large query results -->
                    <cdk-virtual-scroll-viewport itemSize="20" class="query-results-viewport">
                        <pre class="query-results">{{ result | json }}</pre>
                    </cdk-virtual-scroll-viewport>
                }
            </mat-card-content>
        </mat-card>
    }
    `,
    styles: [`
    .auth-card { border-color: var(--mat-sys-tertiary); }
    .auth-field { flex: 1; }
    .action-result { color: var(--mat-sys-primary); }
    .query-field { width: 100%; }
    .query-results-viewport { height: 400px; }
    .query-results {
        background-color: var(--mat-sys-surface-variant);
        padding: 16px;
        border-radius: var(--mat-sys-corner-large);
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        overflow-x: auto;
    }
    `],
})
export class StorageComponent {
    readonly auth = inject(AuthService);
    private readonly storage = inject(StorageService);
    private readonly destroyRef = inject(DestroyRef);

    keyInput = '';
    sqlInput = '';
    readonly actionResult = signal('');

    private readonly authTrigger = signal(0);
    private readonly queryTrigger = signal<string | undefined>(undefined);

    readonly statsResource = rxResource<StorageStats, number | undefined>({
        params: (): number | undefined => this.auth.isAuthenticated() ? this.authTrigger() : undefined,
        stream: () => this.storage.getStats().pipe(
            catchError(() => of({ kvKeys: 0, r2Objects: 0, d1Tables: 0, cacheEntries: 0 } as StorageStats)),
        ),
    });

    readonly queryResource = rxResource<QueryResult, string | undefined>({
        params: (): string | undefined => this.queryTrigger(),
        stream: ({ params }) => params ? this.storage.query(params) : EMPTY,
    });

    authenticate(): void {
        if (this.keyInput.trim()) {
            this.auth.setKey(this.keyInput.trim());
            this.keyInput = '';
            this.authTrigger.update(v => v + 1);
        }
    }

    /**
     * Destructive SQL keywords that should not be executed from the admin console.
     * Matches keywords anywhere in the query (not just at the start) to catch CTEs and
     * multi-statement inputs. Note: keywords inside string literals are also blocked as a
     * deliberate conservative trade-off — backend enforces read-only access as the true guard.
     */
    private static readonly DESTRUCTIVE_SQL = /\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE)\b/i;

    /** Inline warning when destructive SQL is detected */
    readonly sqlWarning = signal<string | null>(null);

    runQuery(): void {
        const sql = this.sqlInput.trim();
        if (!sql) return;

        if (StorageComponent.DESTRUCTIVE_SQL.test(sql)) {
            this.sqlWarning.set('Destructive SQL is blocked. Only SELECT / read-only queries are allowed.');
            return;
        }

        this.sqlWarning.set(null);
        this.queryTrigger.set(sql);
    }

    clearCache(): void {
        this.storage.clearCache().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.actionResult.set('Cache cleared successfully');
                this.authTrigger.update(v => v + 1);
            },
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }

    clearExpired(): void {
        this.storage.clearExpired().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (r) => {
                this.actionResult.set(`Removed ${r.removed} expired entries`);
                this.authTrigger.update(v => v + 1);
            },
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }

    vacuum(): void {
        this.storage.vacuum().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => this.actionResult.set('Database vacuumed successfully'),
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }

    exportData(): void {
        this.storage.exportData().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `storage-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.actionResult.set('Export downloaded');
            },
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }
}
