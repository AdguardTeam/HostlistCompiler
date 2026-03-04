/**
 * Angular PoC - App Component (Root Component)
 *
 * Angular 21 patterns demonstrated:
 *
 * viewChild() — stable v17.3+
 *   Replaces @ViewChild(MatSidenav) sidenav!: MatSidenav;
 *   Returns a Signal<T | undefined> that resolves after the view initialises.
 *   Unlike @ViewChild, it integrates with zoneless change detection automatically —
 *   no ExpressionChangedAfterItHasBeenChecked errors.
 *
 * ThemeService via inject()
 *   Theme state and logic moved to ThemeService (initialised by provideAppInitializer
 *   in app.config.ts). AppComponent reads isDark() directly from the service signal
 *   rather than managing its own copy — single source of truth.
 */

import { Component, inject, signal, viewChild, effect } from '@angular/core';
import { ChildrenOutletContexts, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ThemeService } from './services/theme.service';
import { routeAnimation } from './route-animations';
import { ErrorBoundaryComponent } from './error/error-boundary.component';
import { NotificationContainerComponent } from './notification/notification-container.component';

/** Navigation item interface */
interface NavItem {
    readonly path: string;
    readonly label: string;
    readonly icon: string;
}

/**
 * AppComponent
 * Root shell with Material toolbar + sidenav.
 * Uses viewChild() for the sidenav reference and inject() for ThemeService.
 */
@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        MatToolbarModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        ErrorBoundaryComponent,
        NotificationContainerComponent,
    ],
    animations: [routeAnimation],
    template: `
    <mat-sidenav-container class="app-container">
      <!-- Sidenav -->
      <mat-sidenav
        #sidenav
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="sidenavOpen()"
        class="app-sidenav"
        (closedStart)="sidenavOpen.set(false)"
      >
        <mat-toolbar color="primary" class="sidenav-header">
          <span>Adblock Compiler</span>
        </mat-toolbar>
        <mat-nav-list>
          @for (item of navItems; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive="active-nav-item"
              [routerLinkActiveOptions]="item.path === '/' ? { exact: true } : { exact: false }"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <!-- Main content -->
      <mat-sidenav-content>
        <mat-toolbar color="primary" class="app-toolbar">
          <button
            mat-icon-button
            (click)="toggleSidenav()"
            matTooltip="Toggle navigation"
            aria-label="Toggle navigation"
          >
            <mat-icon>menu</mat-icon>
          </button>
          <span class="toolbar-title">Adblock Compiler</span>
          <span class="toolbar-spacer"></span>
          <button
            mat-icon-button
            (click)="themeService.toggle()"
            [matTooltip]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
            aria-label="Toggle theme"
          >
            <mat-icon>{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
        </mat-toolbar>

        <main class="app-main" role="main" aria-label="Main content">
          <div class="route-container" [@routeAnimation]="getRouteAnimationData()">
            <router-outlet />
          </div>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
    <app-error-boundary />
    <app-notification-container />
  `,
    styles: [`
    .app-container { height: 100vh; }
    .app-sidenav { width: 240px; }
    .sidenav-header { position: sticky; top: 0; z-index: 1; }
    .app-toolbar { position: sticky; top: 0; z-index: 100; }
    .toolbar-title { margin-left: 8px; font-size: 1.1rem; font-weight: 500; }
    .toolbar-spacer { flex: 1 1 auto; }
    .app-main { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .route-container { position: relative; }
    :host ::ng-deep .mat-mdc-list-item.active-nav-item {
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
  `],
})
export class AppComponent {
    readonly navItems: NavItem[] = [
        { path: '/',            label: 'Home',        icon: 'home'              },
        { path: '/compiler',    label: 'Compiler',    icon: 'build'             },
        { path: '/performance', label: 'Performance', icon: 'monitoring'        },
        { path: '/validation',  label: 'Validation',  icon: 'check_circle'      },
        { path: '/api-docs',    label: 'API Docs',    icon: 'description'       },
        { path: '/admin',       label: 'Admin',       icon: 'admin_panel_settings' },
    ];

    /**
     * viewChild() — replaces @ViewChild(MatSidenav) sidenav!: MatSidenav
     * Returns Signal<MatSidenav | undefined>. Resolves after view init.
     * Useful when imperative sidenav control is needed (e.g. sidenav.close()).
     */
    readonly sidenavRef = viewChild<MatSidenav>('sidenav');

    /** Local open-state signal drives the [opened] binding */
    readonly sidenavOpen = signal(true);

    /**
     * BreakpointObserver — toggles sidenav mode between side (desktop) and over (mobile).
     * Converted to a signal via toSignal() for template consumption.
     */
    private readonly breakpointObserver = inject(BreakpointObserver);
    readonly isMobile = toSignal(
        this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
            .pipe(map(result => result.matches)),
        { initialValue: false },
    );

    /**
     * ThemeService injected via inject() (functional DI).
     * Theme is initialised by provideAppInitializer() in app.config.ts,
     * so isDark() is correct from the very first render.
     */
    readonly themeService = inject(ThemeService);

    private readonly contexts = inject(ChildrenOutletContexts);

    constructor() {
        // Auto-close sidenav when switching to mobile layout
        effect(() => {
            if (this.isMobile()) {
                this.sidenavOpen.set(false);
            } else {
                this.sidenavOpen.set(true);
            }
        });
    }

    toggleSidenav(): void {
        this.sidenavOpen.update(open => !open);
    }

    getRouteAnimationData(): string {
        return this.contexts.getContext('primary')?.route?.snapshot?.url.toString() ?? '';
    }
}
