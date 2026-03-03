/**
 * ErrorBoundaryComponent — Displays fallback UI when an unhandled error occurs.
 *
 * Reads from GlobalErrorHandler's lastError signal and shows a dismissible
 * error card with the error message and a retry/dismiss button.
 *
 * Angular 21 patterns: inject(), signal consumption, standalone component
 */

import { Component, ErrorHandler, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GlobalErrorHandler } from './global-error-handler';

@Component({
    selector: 'app-error-boundary',
    standalone: true,
    imports: [MatCardModule, MatButtonModule, MatIconModule],
    template: `
        @if (errorHandler.hasError()) {
            <div class="error-boundary-overlay">
                <mat-card appearance="outlined" class="error-boundary-card">
                    <mat-card-header>
                        <mat-icon mat-card-avatar class="error-icon">error_outline</mat-icon>
                        <mat-card-title>Something went wrong</mat-card-title>
                        <mat-card-subtitle>{{ errorHandler.lastError()?.timestamp?.toLocaleTimeString() }}</mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content>
                        <p class="error-message">{{ errorHandler.lastError()?.message }}</p>
                    </mat-card-content>
                    <mat-card-actions>
                        <button mat-button (click)="dismiss()">
                            <mat-icon>close</mat-icon> Dismiss
                        </button>
                        <button mat-raised-button color="primary" (click)="reload()">
                            <mat-icon>refresh</mat-icon> Reload Page
                        </button>
                    </mat-card-actions>
                </mat-card>
            </div>
        }
    `,
    styles: [`
        .error-boundary-overlay {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            max-width: 420px;
            animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .error-boundary-card {
            border-color: var(--mat-sys-error);
            background-color: var(--mat-sys-error-container, #fce4ec);
        }
        .error-icon { color: var(--mat-sys-error); }
        .error-message {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: var(--mat-sys-on-error-container, var(--mat-sys-error));
            word-break: break-word;
            max-height: 120px;
            overflow-y: auto;
        }
    `],
})
export class ErrorBoundaryComponent {
    readonly errorHandler = inject(ErrorHandler) as GlobalErrorHandler;

    dismiss(): void {
        this.errorHandler.clearError();
    }

    reload(): void {
        window.location.reload();
    }
}
