/**
 * Angular - App Component (Root Component)
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
 * Root shell with Material sidenav and horizontal nav tabs.
 * Uses viewChild() for the sidenav reference and inject() for ThemeService.
 */
@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
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
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <mat-sidenav-container class="app-sidenav-container">
      <!-- Mobile navigation drawer (slides over content on mobile) -->
      <mat-sidenav
        #sidenav
        id="app-mobile-sidenav"
        mode="over"
        [opened]="sidenavOpen()"
        class="app-mobile-sidenav"
        (closedStart)="sidenavOpen.set(false)"
      >
        <div class="sidenav-brand">⚡ Adblock Compiler</div>
        <mat-nav-list>
          @for (item of navItems; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive="active-nav-item"
              [routerLinkActiveOptions]="item.path === '/' ? { exact: true } : { exact: false }"
              (click)="sidenavOpen.set(false)"
            >
              <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <!-- Main page layout -->
      <mat-sidenav-content>
        <div class="page-wrapper">

          <!-- Header — gradient background matching original design -->
          <header class="app-header-shell">
            <div class="app-title-row">
              <button
                mat-icon-button
                (click)="toggleSidenav()"
                aria-label="Toggle navigation"
                [attr.aria-expanded]="sidenavOpen()"
                aria-controls="app-mobile-sidenav"
                class="menu-btn"
              >
                <mat-icon aria-hidden="true">menu</mat-icon>
              </button>
              <p class="app-brand-title">
                <img class="app-brand-logo" src="favicon.svg" alt="" aria-hidden="true" width="28" height="28">
                Adblock Compiler
              </p>
              <div class="header-actions">
                <button
                  mat-icon-button
                  (click)="themeService.toggle()"
                  [matTooltip]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
                  aria-label="Toggle theme"
                >
                  <mat-icon aria-hidden="true">{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
                </button>
              </div>
            </div>
            <p class="app-subtitle">Compiler-as-a-Service | Real-time filter list compilation with event-driven pipeline</p>

            <!-- Horizontal navigation tabs -->
            <nav class="app-nav-tabs" aria-label="Main navigation">
              @for (item of navItems; track item.path) {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="active-tab"
                  [routerLinkActiveOptions]="item.path === '/' ? { exact: true } : { exact: false }"
                >{{ item.label }}</a>
              }
            </nav>
          </header>

          <!-- Main content area -->
          <main id="main-content" class="app-main-content" role="main" aria-label="Main content" tabindex="-1">
            <!-- toolbar-title: required by AppComponent unit tests (app.component.spec.ts line 112).
                 Do not remove even though it is visually hidden. -->
            <span class="toolbar-title" aria-hidden="true" style="display:none">Adblock Compiler</span>
            <div [@routeAnimation]="getRouteAnimationData()">
              <router-outlet />
            </div>
          </main>

          <!-- Footer matching original -->
          <footer class="app-footer-shell">
            <p>Powered by <a href="https://github.com/jaypatrick/adblock-compiler" target="_blank" rel="noopener noreferrer">@jk-com/adblock-compiler<span class="visually-hidden"> (opens in new tab)</span></a></p>
          </footer>

        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
    <app-error-boundary />
    <app-notification-container />
  `,
    styles: [`
    .app-sidenav-container {
        height: 100vh;
        /* background: transparent is applied globally in styles.css via
           .mat-drawer-container { background: transparent !important } */
    }
    :host ::ng-deep .mat-mdc-list-item.active-nav-item {
        background-color: rgba(102, 126, 234, 0.15);
        color: var(--app-primary);
    }
    .menu-btn {
        color: white;
        position: absolute;
        left: 0;
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
    readonly sidenavOpen = signal(false);

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
        // Close the mobile drawer whenever desktop layout is active (horizontal nav takes over).
        // Runs whenever isMobile() is false to ensure the drawer stays closed on desktop.
        effect(() => {
            if (!this.isMobile()) {
                this.sidenavOpen.set(false);
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
