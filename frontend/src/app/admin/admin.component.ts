/**
 * AdminComponent — Storage administration page.
 *
 * Requires admin key authentication. Shows storage stats, D1 tables,
 * and a read-only SQL query console.
 */

import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
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
import { SkeletonCardComponent } from '../skeleton/skeleton-card.component';
import { AuthService } from '../services/auth.service';
import { StorageService, StorageStats, QueryResult } from '../services/storage.service';

@Component({
    selector: 'app-admin',
    standalone: true,
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
    <div class="page-content">
        <h1 class="mat-headline-4">Storage Admin</h1>
        <p class="subtitle mat-body-1">Manage KV, R2, and D1 storage</p>

        <!-- Auth -->
        @if (!auth.isAuthenticated()) {
            <mat-card appearance="outlined" class="auth-card mb-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-tertiary)">lock</mat-icon>
                    <mat-card-title>Authentication Required</mat-card-title>
                    <mat-card-subtitle>Enter your admin key to access storage management</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="auth-row">
                        <mat-form-field appearance="outline" class="auth-field">
                            <mat-label>Admin Key</mat-label>
                            <input matInput type="password" [(ngModel)]="keyInput"
                                (keyup.enter)="authenticate()" placeholder="X-Admin-Key" />
                            <mat-icon matSuffix>vpn_key</mat-icon>
                        </mat-form-field>
                        <button mat-raised-button color="primary" (click)="authenticate()">
                            <span><mat-icon>login</mat-icon> Authenticate</span>
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
                    <div class="status-bar">
                        <mat-chip-set>
                            <mat-chip highlighted color="primary">
                                <mat-icon>check_circle</mat-icon> Authenticated
                            </mat-chip>
                        </mat-chip-set>
                        <button mat-stroked-button color="warn" (click)="auth.clearKey()">
                            <span><mat-icon>logout</mat-icon> Logout</span>
                        </button>
                    </div>
                </mat-card-content>
            </mat-card>

            <!-- Stats -->
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar>bar_chart</mat-icon>
                    <mat-card-title>Storage Stats</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    @if (statsResource.isLoading()) {
                        <!-- Item 13: skeleton loading state -->
                        <div class="stats-grid">
                            @for (i of [0,1,2,3]; track i) {
                                <app-skeleton-card [lines]="1" [lineWidths]="['60%']" />
                            }
                        </div>
                    } @else if (statsResource.value(); as stats) {
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-value">{{ stats.kvKeys }}</span>
                                <span class="stat-label">KV Keys</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">{{ stats.r2Objects }}</span>
                                <span class="stat-label">R2 Objects</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">{{ stats.d1Tables }}</span>
                                <span class="stat-label">D1 Tables</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">{{ stats.cacheEntries }}</span>
                                <span class="stat-label">Cache Entries</span>
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
                    <mat-icon mat-card-avatar>settings</mat-icon>
                    <mat-card-title>Actions</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    <div class="actions-row">
                        <button mat-stroked-button (click)="clearCache()">
                            <span><mat-icon>delete_sweep</mat-icon> Clear Cache</span>
                        </button>
                        <button mat-stroked-button (click)="clearExpired()">
                            <span><mat-icon>auto_delete</mat-icon> Clear Expired</span>
                        </button>
                        <button mat-stroked-button (click)="vacuum()">
                            <span><mat-icon>compress</mat-icon> Vacuum DB</span>
                        </button>
                        <button mat-stroked-button (click)="exportData()">
                            <span><mat-icon>download</mat-icon> Export</span>
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
                    <mat-icon mat-card-avatar>terminal</mat-icon>
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
                    <button mat-raised-button color="primary" (click)="runQuery()"
                        [disabled]="queryResource.isLoading() || !sqlInput.trim()">
                        @if (queryResource.isLoading()) {
                            <mat-progress-spinner diameter="20" mode="indeterminate" />
                        } @else {
                            <span><mat-icon>play_arrow</mat-icon> Execute</span>
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
                        <!-- Item 6: CDK Virtual Scroll for large query results -->
                        <cdk-virtual-scroll-viewport itemSize="20" class="query-results-viewport">
                            <pre class="query-results">{{ result | json }}</pre>
                        </cdk-virtual-scroll-viewport>
                    }
                </mat-card-content>
            </mat-card>
        }
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .auth-card { border-color: var(--mat-sys-tertiary); }
    .auth-row { display: flex; align-items: center; gap: 12px; }
    .auth-field { flex: 1; }
    .status-bar { display: flex; align-items: center; justify-content: space-between; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
    .stat-item { display: flex; flex-direction: column; align-items: center; padding: 16px; border-radius: 8px; background: var(--mat-sys-surface-variant); }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: var(--mat-sys-on-surface-variant); text-transform: uppercase; letter-spacing: 0.05em; }
    .actions-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .action-result { color: var(--mat-sys-primary); }
    .query-field { width: 100%; }
    .query-results-viewport { height: 400px; }
    .query-results {
        background: var(--mat-sys-surface-variant); padding: 16px; border-radius: 8px;
        font-family: 'Courier New', monospace; font-size: 12px; overflow-x: auto;
    }
  `],
})
export class AdminComponent {
    readonly auth = inject(AuthService);
    private readonly storage = inject(StorageService);

    keyInput = '';
    sqlInput = '';
    readonly actionResult = signal('');

    private readonly authTrigger = signal(0);
    private readonly queryTrigger = signal<string | undefined>(undefined);

    readonly statsResource = rxResource<StorageStats, number>({
        params: () => this.auth.isAuthenticated() ? this.authTrigger() : undefined as unknown as number,
        stream: () => this.storage.getStats().pipe(
            catchError(() => of({ kvKeys: 0, r2Objects: 0, d1Tables: 0, cacheEntries: 0 } as StorageStats)),
        ),
    });

    readonly queryResource = rxResource<QueryResult, string | undefined>({
        params: () => this.queryTrigger(),
        stream: ({ params }) => {
            if (!params) return of(undefined as unknown as QueryResult);
            return this.storage.query(params);
        },
    });

    authenticate(): void {
        if (this.keyInput.trim()) {
            this.auth.setKey(this.keyInput.trim());
            this.keyInput = '';
            this.authTrigger.update(v => v + 1);
        }
    }

    runQuery(): void {
        if (this.sqlInput.trim()) {
            this.queryTrigger.set(this.sqlInput.trim());
        }
    }

    clearCache(): void {
        this.storage.clearCache().subscribe({
            next: () => {
                this.actionResult.set('Cache cleared successfully');
                this.authTrigger.update(v => v + 1);
            },
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }

    clearExpired(): void {
        this.storage.clearExpired().subscribe({
            next: (r) => {
                this.actionResult.set(`Removed ${r.removed} expired entries`);
                this.authTrigger.update(v => v + 1);
            },
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }

    vacuum(): void {
        this.storage.vacuum().subscribe({
            next: () => this.actionResult.set('Database vacuumed successfully'),
            error: (e) => this.actionResult.set(`Error: ${e.message}`),
        });
    }

    exportData(): void {
        this.storage.exportData().subscribe({
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
