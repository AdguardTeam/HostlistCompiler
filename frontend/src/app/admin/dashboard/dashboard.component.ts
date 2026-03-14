import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-admin-dashboard',
    imports: [MatCardModule, MatIconModule],
    template: `
    <mat-card appearance="outlined">
        <mat-card-header>
            <mat-icon mat-card-avatar aria-hidden="true">dashboard</mat-icon>
            <mat-card-title>Dashboard</mat-card-title>
            <mat-card-subtitle>System overview and key metrics</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
            <p class="placeholder">Coming soon — aggregate stats, recent activity, and health checks.</p>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`.placeholder { color: var(--mat-sys-on-surface-variant); margin-top: 16px; }`],
})
export class DashboardComponent {}
