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

import { Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from './services/theme.service';

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
    standalone: true,
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
    ],
    template: `
    <mat-sidenav-container class="app-container">
      <!-- Sidenav -->
      <mat-sidenav
        #sidenav
        mode="side"
        [opened]="sidenavOpen()"
        class="app-sidenav"
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
              [routerLinkActiveOptions]="item.path === '/' ? { exact: true } : {}"
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

        <main class="app-main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
    styles: [`
    .app-container { height: 100vh; }
    .app-sidenav { width: 240px; }
    .sidenav-header { position: sticky; top: 0; z-index: 1; }
    .app-toolbar { position: sticky; top: 0; z-index: 100; }
    .toolbar-title { margin-left: 8px; font-size: 1.1rem; font-weight: 500; }
    .toolbar-spacer { flex: 1 1 auto; }
    .app-main { padding: 24px; max-width: 1200px; margin: 0 auto; }
    :host ::ng-deep .mat-mdc-list-item.active-nav-item {
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
  `],
})
export class AppComponent {
    readonly navItems: NavItem[] = [
        { path: '/',          label: 'Home',      icon: 'home'      },
        { path: '/compiler',  label: 'Compiler',  icon: 'settings'  },
        { path: '/signals',   label: 'Signals',   icon: 'bolt'      },
        { path: '/benchmark', label: 'Benchmark', icon: 'bar_chart' },
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
     * ThemeService injected via inject() (functional DI).
     * Theme is initialised by provideAppInitializer() in app.config.ts,
     * so isDark() is correct from the very first render.
     */
    readonly themeService = inject(ThemeService);

    toggleSidenav(): void {
        this.sidenavOpen.update(open => !open);
    }
}
