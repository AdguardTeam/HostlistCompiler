/**
 * NotificationContainerComponent — Fixed overlay that renders toast notifications.
 *
 * Reads from NotificationService.toasts() signal and renders each toast
 * with a slide-in animation and auto-dismiss behavior.
 *
 * Added to AppComponent template alongside <app-error-boundary />.
 */

import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../services/notification.service';

@Component({
    selector: 'app-notification-container',
    imports: [MatCardModule, MatIconModule, MatButtonModule],
    template: `
        <div class="toast-container" aria-live="polite" role="status" aria-atomic="false">
            @for (toast of notificationService.toasts(); track toast.id) {
                <mat-card class="toast" [class]="toast.type" appearance="outlined">
                    <mat-icon class="toast-icon" aria-hidden="true">{{ iconFor(toast.type) }}</mat-icon>
                    <div class="toast-body">
                        <div class="toast-title">{{ toast.title }}</div>
                        <div class="toast-message">{{ toast.message }}</div>
                    </div>
                    <button mat-icon-button class="toast-close" (click)="notificationService.dismissToast(toast.id)"
                        aria-label="Dismiss notification">
                        <mat-icon aria-hidden="true">close</mat-icon>
                    </button>
                </mat-card>
            }
        </div>
    `,
    styles: [`
        .toast-icon { flex-shrink: 0; font-size: 24px; width: 24px; height: 24px; }
        .toast.success .toast-icon { color: var(--app-success); }
        .toast.error .toast-icon { color: var(--app-error); }
        .toast.warning .toast-icon { color: var(--app-warning); }
        .toast.info .toast-icon { color: var(--app-info); }
        .toast-body { flex: 1; min-width: 0; }
        .toast-close {
            flex-shrink: 0;
            width: 28px;
            height: 28px;
            line-height: 28px;
        }
        .toast-close mat-icon { font-size: 18px; }
    `],
})
export class NotificationContainerComponent {
    readonly notificationService = inject(NotificationService);

    iconFor(type: string): string {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
            default: return 'info';
        }
    }
}
