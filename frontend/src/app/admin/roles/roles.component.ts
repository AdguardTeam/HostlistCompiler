import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-admin-roles',
    imports: [MatCardModule, MatIconModule],
    template: `
    <mat-card appearance="outlined">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">admin_panel_settings</mat-icon>
            <mat-card-title>Roles &amp; Permissions</mat-card-title>
            <mat-card-subtitle>Define roles and assign granular permissions</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
            <p class="placeholder">Coming soon — role editor with permission matrix.</p>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`.placeholder { color: var(--mat-sys-on-surface-variant); margin-top: 16px; }`],
})
export class RolesComponent {}
