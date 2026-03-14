import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-admin-api-keys',
    imports: [MatCardModule, MatIconModule],
    template: `
    <mat-card appearance="outlined">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">vpn_key</mat-icon>
            <mat-card-title>API Key Management</mat-card-title>
            <mat-card-subtitle>View, revoke, and audit API keys across all users</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
            <p class="placeholder">Coming soon — global API key table with usage analytics and revocation.</p>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`.placeholder { color: var(--mat-sys-on-surface-variant); margin-top: 16px; }`],
})
export class ApiKeysComponent {}
