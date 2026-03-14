import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-admin-audit-log',
    imports: [MatCardModule, MatIconModule],
    template: `
    <mat-card appearance="outlined">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">receipt_long</mat-icon>
            <mat-card-title>Audit Log</mat-card-title>
            <mat-card-subtitle>Track administrative actions and system events</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
            <p class="placeholder">Coming soon — searchable audit trail with actor, action, and resource details.</p>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`.placeholder { color: var(--mat-sys-on-surface-variant); margin-top: 16px; }`],
})
export class AuditLogComponent {}
