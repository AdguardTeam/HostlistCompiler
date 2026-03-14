import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-admin-scopes',
    imports: [MatCardModule, MatIconModule],
    template: `
    <mat-card appearance="outlined">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">security</mat-icon>
            <mat-card-title>Scope Registry</mat-card-title>
            <mat-card-subtitle>Manage OAuth scopes and their descriptions</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
            <p class="placeholder">Coming soon — scope CRUD with dependency graph visualization.</p>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`.placeholder { color: var(--mat-sys-on-surface-variant); margin-top: 16px; }`],
})
export class ScopesComponent {}
