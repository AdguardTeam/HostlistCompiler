/**
 * AdminComponent — Shell layout for the admin area.
 *
 * Provides a Material sidenav with grouped navigation that lazy-loads
 * child panel components via `<router-outlet>`. The sidenav collapses
 * to icon-only mode on narrow viewports.
 */

import { Component, inject, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs/operators';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

/* ------------------------------------------------------------------ */
/*  Navigation model                                                  */
/* ------------------------------------------------------------------ */

interface NavItem {
    label: string;
    icon: string;
    route: string;
    /** Future: gate visibility behind this permission string. */
    permission?: string;
}

interface NavGroup {
    section: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        section: 'Overview',
        items: [
            { label: 'Dashboard', icon: 'dashboard', route: 'dashboard' },
        ],
    },
    {
        section: 'Identity & Access',
        items: [
            { label: 'Users', icon: 'people', route: 'users', permission: 'admin:users:read' },
            { label: 'Roles & Permissions', icon: 'admin_panel_settings', route: 'roles', permission: 'admin:roles:read' },
            { label: 'API Keys', icon: 'vpn_key', route: 'api-keys', permission: 'admin:api-keys:read' },
        ],
    },
    {
        section: 'Configuration',
        items: [
            { label: 'Tiers', icon: 'layers', route: 'tiers', permission: 'admin:tiers:read' },
            { label: 'Scopes', icon: 'security', route: 'scopes', permission: 'admin:scopes:read' },
            { label: 'Endpoints', icon: 'api', route: 'endpoints', permission: 'admin:endpoints:read' },
            { label: 'Feature Flags', icon: 'flag', route: 'feature-flags', permission: 'admin:flags:read' },
        ],
    },
    {
        section: 'Monitoring',
        items: [
            { label: 'Observability', icon: 'monitoring', route: 'observability', permission: 'admin:observability:read' },
            { label: 'Audit Log', icon: 'receipt_long', route: 'audit-log', permission: 'admin:audit:read' },
        ],
    },
    {
        section: 'System',
        items: [
            { label: 'Storage', icon: 'storage', route: 'storage', permission: 'admin:storage:read' },
            { label: 'Announcements', icon: 'campaign', route: 'announcements', permission: 'admin:announcements:read' },
            { label: 'Webhooks', icon: 'webhook', route: 'webhooks', permission: 'admin:webhooks:read' },
        ],
    },
];

@Component({
    selector: 'app-admin',
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        MatToolbarModule,
        MatDividerModule,
        MatTooltipModule,
        MatButtonModule,
    ],
    template: `
    <mat-sidenav-container class="admin-shell">
        <!-- Sidenav -->
        <mat-sidenav
            [mode]="isMobile() ? 'over' : 'side'"
            [opened]="!isMobile() || sidenavOpen()"
            (closed)="sidenavOpen.set(false)"
            class="admin-sidenav"
            [class.collapsed]="collapsed() && !isMobile()"
        >
            <!-- Sidenav header -->
            <mat-toolbar class="sidenav-header">
                @if (!collapsed() || isMobile()) {
                    <mat-icon aria-hidden="true">shield</mat-icon>
                    <span class="sidenav-title">Admin</span>
                }
                <span class="spacer"></span>
                @if (!isMobile()) {
                    <button mat-icon-button
                        (click)="collapsed.set(!collapsed())"
                        [matTooltip]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
                        aria-label="Toggle sidebar width">
                        <mat-icon aria-hidden="true">{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
                    </button>
                }
            </mat-toolbar>

            <!-- Navigation groups -->
            <mat-nav-list>
                @for (group of navGroups; track group.section) {
                    @if (!collapsed() || isMobile()) {
                        <div class="nav-section-label">{{ group.section }}</div>
                    } @else {
                        <mat-divider></mat-divider>
                    }

                    @for (item of group.items; track item.route) {
                        <a mat-list-item
                            [routerLink]="item.route"
                            routerLinkActive="active-link"
                            [attr.data-permission]="item.permission ?? null"
                            [matTooltip]="collapsed() && !isMobile() ? item.label : ''"
                            matTooltipPosition="right"
                            (click)="isMobile() ? sidenavOpen.set(false) : null"
                        >
                            <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
                            @if (!collapsed() || isMobile()) {
                                <span matListItemTitle>{{ item.label }}</span>
                            }
                        </a>
                    }
                }
            </mat-nav-list>
        </mat-sidenav>

        <!-- Main content -->
        <mat-sidenav-content class="admin-content">
            <!-- Mobile top bar -->
            @if (isMobile()) {
                <mat-toolbar class="mobile-toolbar">
                    <button mat-icon-button (click)="sidenavOpen.set(true)" aria-label="Open admin menu">
                        <mat-icon aria-hidden="true">menu</mat-icon>
                    </button>
                    <span>Admin</span>
                </mat-toolbar>
            }

            <div class="content-area">
                <router-outlet />
            </div>
        </mat-sidenav-content>
    </mat-sidenav-container>
    `,
    styles: [`
    :host {
        display: block;
        height: 100%;
    }

    .admin-shell {
        height: calc(100vh - 64px); /* below the app toolbar */
    }

    /* ---- Sidenav ---- */
    .admin-sidenav {
        width: 260px;
        border-right: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface);
        transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .admin-sidenav.collapsed {
        width: 64px;
    }

    .sidenav-header {
        background: transparent;
        gap: 8px;
        font-size: 16px;
        font-weight: 500;
        padding: 0 12px;
    }

    .sidenav-title {
        white-space: nowrap;
    }

    .spacer {
        flex: 1 1 auto;
    }

    /* ---- Nav sections ---- */
    .nav-section-label {
        padding: 16px 16px 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--mat-sys-on-surface-variant);
    }

    /* Active link highlight */
    .active-link {
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent) !important;
        color: var(--mat-sys-primary) !important;
        border-radius: 8px;
    }

    .active-link mat-icon {
        color: var(--mat-sys-primary);
    }

    /* ---- Content ---- */
    .admin-content {
        background: var(--mat-sys-surface-container-lowest);
    }

    .mobile-toolbar {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--mat-sys-surface);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        gap: 8px;
    }

    .content-area {
        padding: 24px;
        max-width: 1200px;
    }

    /* Responsive */
    @media (max-width: 959px) {
        .admin-shell {
            height: calc(100vh - 56px);
        }
    }
    `],
})
export class AdminComponent {
    private readonly breakpointObserver = inject(BreakpointObserver);

    /** Navigation model exposed to the template. */
    readonly navGroups = NAV_GROUPS;

    /** Whether the viewport is mobile-width. */
    readonly isMobile = toSignal(
        this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).pipe(
            map(result => result.matches),
        ),
        { initialValue: false },
    );

    /** Whether the sidenav is collapsed to icon-only mode (desktop). */
    readonly collapsed = signal(false);

    /** Whether the overlay sidenav is open (mobile). */
    readonly sidenavOpen = signal(false);
}
