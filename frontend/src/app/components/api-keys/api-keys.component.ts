/**
 * ApiKeysComponent — API key management page.
 *
 * Lets authenticated users create, view, copy, and revoke personal API
 * keys used for programmatic access to the compiler service.
 *
 * Key design choices:
 *   - Standalone Angular 21 component (no NgModule)
 *   - Signal-based state via ApiKeyService
 *   - `@if` / `@for` modern control flow
 *   - Plaintext key shown **once** on creation with copy button
 *   - Material card-based layout consistent with the rest of the app
 */

import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { ApiKeyService, CreateApiKeyRequest } from '../../services/api-key.service';
import { ClerkService } from '../../services/clerk.service';

@Component({
    selector: 'app-api-keys',
    standalone: true,
    imports: [
        FormsModule,
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatDividerModule,
        MatTooltipModule,
        MatSnackBarModule,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">API Keys</h1>
        <p class="subtitle mat-body-1">Manage your personal API keys for programmatic access</p>

        @if (!clerk.isSignedIn()) {
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-content>
                    <p>Please <a routerLink="/sign-in">sign in</a> to manage API keys.</p>
                </mat-card-content>
            </mat-card>
        } @else {
            <!-- Newly created key banner -->
            @if (newKeyPlaintext()) {
                <mat-card appearance="outlined" class="key-banner mb-2">
                    <mat-card-header>
                        <mat-icon mat-card-avatar style="color: var(--mat-sys-primary)" aria-hidden="true">vpn_key</mat-icon>
                        <mat-card-title>API Key Created</mat-card-title>
                        <mat-card-subtitle>Copy this key now — it won't be shown again</mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content>
                        <div class="key-display">
                            <code class="key-text">{{ newKeyPlaintext() }}</code>
                            <button mat-icon-button
                                    matTooltip="Copy to clipboard"
                                    (click)="copyKey(newKeyPlaintext()!)">
                                <mat-icon>content_copy</mat-icon>
                            </button>
                        </div>
                    </mat-card-content>
                    <mat-card-actions>
                        <button mat-button (click)="dismissNewKey()">Dismiss</button>
                    </mat-card-actions>
                </mat-card>
            }

            <!-- Create key form -->
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-tertiary)" aria-hidden="true">add_circle</mat-icon>
                    <mat-card-title>Create New Key</mat-card-title>
                    <mat-card-subtitle>Generate a new API key for programmatic access</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="create-form">
                        <mat-form-field appearance="outline" class="name-field">
                            <mat-label>Key Name</mat-label>
                            <input matInput [ngModel]="newKeyName()"
                                   (ngModelChange)="newKeyName.set($event)"
                                   placeholder="e.g. CI Pipeline" maxlength="100" />
                            <mat-hint>A friendly name to identify this key</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="scopes-field">
                            <mat-label>Scopes</mat-label>
                            <mat-select [ngModel]="newKeyScopes()"
                                        (ngModelChange)="newKeyScopes.set($event)" multiple>
                                <mat-option value="compile">compile</mat-option>
                                <mat-option value="rules">rules</mat-option>
                            </mat-select>
                            <mat-hint>Permissions granted to this key</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" class="expiry-field">
                            <mat-label>Expires In (days)</mat-label>
                            <input matInput type="number" [ngModel]="newKeyExpiryDays()"
                                   (ngModelChange)="newKeyExpiryDays.set($event ? Number($event) : null)"
                                   min="1" max="365" placeholder="90" />
                            <mat-hint>Leave empty for no expiry</mat-hint>
                        </mat-form-field>
                    </div>
                </mat-card-content>
                <mat-card-actions>
                    <button mat-flat-button color="primary"
                            [disabled]="!newKeyName() || creating()"
                            (click)="createKey()">
                        @if (creating()) {
                            <mat-spinner diameter="18" />
                        } @else {
                            <mat-icon>vpn_key</mat-icon>
                        }
                        Create Key
                    </button>
                </mat-card-actions>
            </mat-card>

            <!-- Key list -->
            <mat-card appearance="outlined">
                <mat-card-header>
                    <mat-icon mat-card-avatar style="color: var(--mat-sys-secondary)" aria-hidden="true">key</mat-icon>
                    <mat-card-title>Your Keys ({{ apiKeys.count() }})</mat-card-title>
                    <mat-card-subtitle>{{ apiKeys.activeKeys().length }} active</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    @if (apiKeys.loading()) {
                        <div class="loading-spinner">
                            <mat-spinner diameter="32" />
                        </div>
                    } @else if (apiKeys.keys().length === 0) {
                        <p class="empty-state">No API keys yet. Create one above to get started.</p>
                    } @else {
                        <div class="key-list">
                            @for (key of apiKeys.keys(); track key.id) {
                                <div class="key-item" [class.revoked]="!!key.revokedAt" [class.expired]="isExpired(key)">
                                    <div class="key-info">
                                        <div class="key-header">
                                            <strong>{{ key.name }}</strong>
                                            <code class="key-prefix">{{ key.keyPrefix }}...</code>
                                            @if (key.revokedAt) {
                                                <mat-icon class="status-icon revoked" matTooltip="Revoked">block</mat-icon>
                                            } @else if (isExpired(key)) {
                                                <mat-icon class="status-icon expired" matTooltip="Expired">schedule</mat-icon>
                                            } @else {
                                                <mat-icon class="status-icon active" matTooltip="Active">check_circle</mat-icon>
                                            }
                                        </div>
                                        <div class="key-meta">
                                            <span>Scopes: {{ key.scopes.join(', ') }}</span>
                                            <span>Created: {{ key.createdAt | date:'mediumDate' }}</span>
                                            @if (key.lastUsedAt) {
                                                <span>Last used: {{ key.lastUsedAt | date:'mediumDate' }}</span>
                                            }
                                            @if (key.expiresAt) {
                                                <span>Expires: {{ key.expiresAt | date:'mediumDate' }}</span>
                                            }
                                        </div>
                                    </div>
                                    <div class="key-actions">
                                        @if (!key.revokedAt) {
                                            <button mat-icon-button color="warn"
                                                    matTooltip="Revoke key"
                                                    (click)="revokeKey(key.id, key.name)">
                                                <mat-icon>delete</mat-icon>
                                            </button>
                                        }
                                    </div>
                                </div>
                                <mat-divider />
                            }
                        </div>
                    }

                    @if (apiKeys.error()) {
                        <p class="error-msg">{{ apiKeys.error() }}</p>
                    }
                </mat-card-content>
            </mat-card>
        }
    </div>
    `,
    styles: `
        .page-content { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
        .mb-2 { margin-bottom: 16px; }
        .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }

        .key-banner { border-left: 4px solid var(--mat-sys-primary); }
        .key-display {
            display: flex; align-items: center; gap: 8px;
            background: var(--mat-sys-surface-container); padding: 12px 16px;
            border-radius: 8px; margin-top: 8px;
        }
        .key-text {
            font-family: monospace; font-size: 14px;
            word-break: break-all; flex: 1;
        }

        .create-form {
            display: flex; flex-wrap: wrap; gap: 16px;
            margin-top: 8px;
        }
        .name-field { flex: 1; min-width: 200px; }
        .scopes-field { min-width: 150px; }
        .expiry-field { min-width: 120px; max-width: 160px; }

        .loading-spinner { display: flex; justify-content: center; padding: 24px; }
        .empty-state { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 24px; }

        .key-list { margin-top: 8px; }
        .key-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 0;
        }
        .key-item.revoked { opacity: 0.5; }
        .key-item.expired { opacity: 0.7; }

        .key-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .key-prefix {
            font-family: monospace; font-size: 12px;
            background: var(--mat-sys-surface-container); padding: 2px 6px;
            border-radius: 4px;
        }
        .status-icon { font-size: 18px; width: 18px; height: 18px; }
        .status-icon.active { color: var(--mat-sys-primary); }
        .status-icon.revoked { color: var(--mat-sys-error); }
        .status-icon.expired { color: var(--mat-sys-outline); }

        .key-meta {
            display: flex; flex-wrap: wrap; gap: 12px;
            font-size: 12px; color: var(--mat-sys-on-surface-variant);
        }

        .error-msg {
            color: var(--mat-sys-error); margin-top: 12px;
            padding: 8px; background: var(--mat-sys-error-container);
            border-radius: 4px;
        }
    `,
})
export class ApiKeysComponent implements OnInit {
    protected readonly apiKeys = inject(ApiKeyService);
    protected readonly clerk = inject(ClerkService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly platformId = inject(PLATFORM_ID);

    // Create-form state
    protected readonly newKeyName = signal('');
    protected readonly newKeyScopes = signal<string[]>(['compile']);
    protected readonly newKeyExpiryDays = signal<number | null>(null);
    protected readonly creating = signal(false);

    // One-time plaintext display
    protected readonly newKeyPlaintext = signal<string | null>(null);

    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId) && this.clerk.isSignedIn()) {
            this.apiKeys.loadKeys();
        }
    }

    async createKey(): Promise<void> {
        const name = this.newKeyName().trim();
        if (!name) return;

        this.creating.set(true);
        const req: CreateApiKeyRequest = { name, scopes: this.newKeyScopes() };
        const expiry = this.newKeyExpiryDays();
        if (expiry && expiry > 0) {
            req.expiresInDays = expiry;
        }

        const plaintext = await this.apiKeys.createKey(req);
        this.creating.set(false);

        if (plaintext) {
            this.newKeyPlaintext.set(plaintext);
            this.newKeyName.set('');
            this.newKeyExpiryDays.set(null);
            this.snackBar.open('API key created!', 'OK', { duration: 3000 });
        }
    }

    async revokeKey(id: string, name: string): Promise<void> {
        // Simple confirm — no Material dialog to keep it lightweight
        if (!isPlatformBrowser(this.platformId)) return;
        const win = globalThis as { confirm?: (msg: string) => boolean };
        if (win.confirm && !win.confirm(`Revoke API key "${name}"? This cannot be undone.`)) return;

        const ok = await this.apiKeys.revokeKey(id);
        if (ok) {
            this.snackBar.open('API key revoked', 'OK', { duration: 3000 });
        }
    }

    copyKey(text: string): void {
        if (!isPlatformBrowser(this.platformId)) return;
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied to clipboard', 'OK', { duration: 2000 });
        });
    }

    dismissNewKey(): void {
        this.newKeyPlaintext.set(null);
    }

    isExpired(key: { expiresAt: string | null; revokedAt: string | null }): boolean {
        return !key.revokedAt && !!key.expiresAt && new Date(key.expiresAt) < new Date();
    }
}
