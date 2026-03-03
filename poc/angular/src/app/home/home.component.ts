/**
 * Angular PoC - Home/Dashboard Component
 *
 * Angular 21 patterns demonstrated:
 *
 * StatCardComponent (input / output / model signal APIs)
 *   The stats grid uses the new <app-stat-card> component, binding inputs with
 *   the signal input() API and two-way [(highlighted)] with model().
 *
 * @defer — stable v17+
 *   Defers loading and rendering of a child component until a trigger fires.
 *   With SSR + RenderMode.Prerender on this route, @defer enables incremental
 *   hydration: the placeholder HTML is sent in the initial payload and the
 *   heavy component is hydrated progressively as it enters the viewport.
 *
 *   Triggers:
 *     on viewport  — defers until the block enters the viewport (IntersectionObserver)
 *     on idle      — defers until requestIdleCallback fires
 *     on interaction — defers on first click / focus
 *     on timer(n)  — defers after n milliseconds
 *     when (expr)  — defers until a signal/boolean becomes truthy
 *
 *   Sub-blocks:
 *     @placeholder  — shown while the dependency chunk is being fetched
 *     @loading      — shown while the async loader is running (minimum 300ms avoids flicker)
 *     @error        — shown if the loader throws
 *
 * viewChild() — stable v17.3+
 *   Typed signal query for a template element or directive reference.
 *   Used here to get the action-card element for programmatic focus management.
 */

import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StatCardComponent } from '../stat-card/stat-card.component';

/** Interface for stat cards data */
interface StatCard {
    readonly label: string;
    readonly value: string;
    readonly icon: string;
    readonly color: string;
}

/**
 * HomeComponent
 * Dashboard page with @defer, signal inputs via StatCardComponent, and viewChild().
 */
@Component({
    selector: 'app-home',
    standalone: true,
    imports: [
        RouterLink,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        StatCardComponent,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">Adblock Compiler Dashboard</h1>
        <p class="mat-body-1 subtitle">
            Welcome to the Angular 21 PoC. Compile and transform adblock filter lists.
        </p>

        <!-- Stats Grid using StatCardComponent (signal input / output / model APIs) -->
        <div class="stats-grid">
            @for (stat of stats; track stat.label) {
                <!--
                    input()   → label, value, icon, color are signal inputs
                    model()   → [(highlighted)] is a two-way writable signal binding
                    output()  → (cardClicked) fires when the card is clicked
                -->
                <app-stat-card
                    [label]="stat.label"
                    [value]="stat.value"
                    [icon]="stat.icon"
                    [color]="stat.color"
                    [(highlighted)]="highlightedCard"
                    (cardClicked)="onStatCardClicked($event)"
                />
            }
        </div>

        <mat-divider class="mb-3 mt-3"></mat-divider>

        <!-- Action card — viewChild() target -->
        <mat-card #actionCard appearance="outlined" class="action-card">
            <mat-card-header>
                <mat-card-title>Get Started</mat-card-title>
                <mat-card-subtitle>Navigate to the Compiler to compile filter lists</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <div class="action-buttons mt-2">
                    <button mat-raised-button color="primary" (click)="goToCompiler()">
                        <mat-icon>settings</mat-icon>
                        Start Compiling
                    </button>
                    <a mat-stroked-button color="primary" routerLink="/compiler">
                        <mat-icon>link</mat-icon>
                        Open Compiler
                    </a>
                </div>
            </mat-card-content>
            <mat-card-actions>
                <mat-chip-set>
                    <mat-chip highlighted color="primary">Angular 21</mat-chip>
                    <mat-chip>Material Design 3</mat-chip>
                    <mat-chip>SSR</mat-chip>
                    <mat-chip>Signals</mat-chip>
                    <mat-chip>&#64;defer</mat-chip>
                </mat-chip-set>
            </mat-card-actions>
        </mat-card>

        <!--
            @defer with 'on viewport' trigger
            The SignalsShowcaseCard is heavy (imports the Signals component template inline).
            With @defer, the JS chunk is only fetched + rendered when it scrolls into view.
            @placeholder shows a spinner immediately; @loading is shown while hydrating.

            This block pairs with SSR's incremental hydration: the server renders the
            @placeholder HTML; the client hydrates lazily when triggered.
        -->
        @defer (on viewport) {
            <mat-card appearance="outlined" class="info-card mt-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar>info</mat-icon>
                    <mat-card-title>Angular 21 Feature Highlights</mat-card-title>
                    <mat-card-subtitle>All demonstrated in this PoC</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="feature-grid">
                        @for (feature of angularFeatures; track feature.name) {
                            <div class="feature-item">
                                <mat-icon [style.color]="feature.color">{{ feature.icon }}</mat-icon>
                                <div>
                                    <strong>{{ feature.name }}</strong>
                                    <p class="mat-caption">{{ feature.description }}</p>
                                </div>
                            </div>
                        }
                    </div>
                </mat-card-content>
            </mat-card>
        } @placeholder (minimum 200ms) {
            <!-- Shown immediately while the chunk is loading -->
            <mat-card appearance="outlined" class="info-card mt-2">
                <mat-card-content class="placeholder-content">
                    <mat-spinner diameter="32"></mat-spinner>
                    <span class="mat-body-2">Loading feature highlights…</span>
                </mat-card-content>
            </mat-card>
        } @loading (minimum 300ms; after 100ms) {
            <!-- Shown while the deferred block's async loader runs -->
            <mat-card appearance="outlined" class="info-card mt-2">
                <mat-card-content class="placeholder-content">
                    <mat-spinner diameter="32" color="accent"></mat-spinner>
                    <span class="mat-body-2">Rendering…</span>
                </mat-card-content>
            </mat-card>
        }
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }

    .subtitle {
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 24px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .action-card { margin-bottom: 16px; }

    .action-buttons { display: flex; gap: 12px; flex-wrap: wrap; }

    .info-card { background-color: var(--mat-sys-surface-variant); }

    .feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 8px;
    }

    .feature-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .feature-item mat-icon { flex-shrink: 0; margin-top: 2px; }

    .feature-item p { margin: 2px 0 0; color: var(--mat-sys-on-surface-variant); }

    .placeholder-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 24px;
    }
  `],
})
export class HomeComponent {
    readonly stats: StatCard[] = [
        { label: 'Filter Lists Compiled', value: '1,234', icon: 'filter_list', color: 'var(--mat-sys-primary)'        },
        { label: 'Total Rules Processed',  value: '456K',  icon: 'rule',        color: 'var(--mat-sys-tertiary)'      },
        { label: 'Active Transformations', value: '12',    icon: 'transform',   color: 'var(--mat-sys-secondary)'     },
        { label: 'Cache Hit Rate',         value: '89%',   icon: 'speed',       color: 'var(--mat-sys-error-container)'},
    ];

    readonly angularFeatures = [
        { name: 'signal() / computed() / effect()',  icon: 'bolt',       color: 'var(--mat-sys-primary)',   description: 'Fine-grained reactive state without Zone.js'            },
        { name: 'input() / output() / model()',      icon: 'input',      color: 'var(--mat-sys-secondary)', description: 'Signal-based component API replacing @Input/@Output'    },
        { name: 'viewChild() / contentChild()',      icon: 'search',     color: 'var(--mat-sys-tertiary)',  description: 'Signal queries replacing @ViewChild/@ContentChild'      },
        { name: '@defer deferrable views',           icon: 'hourglass_empty', color: 'var(--mat-sys-primary)', description: 'Lazy-render blocks with viewport / idle / when triggers' },
        { name: 'resource() / rxResource()',         icon: 'cloud_download', color: 'var(--mat-sys-secondary)', description: 'Signal-native async data with built-in loading/error state' },
        { name: 'linkedSignal()',                    icon: 'link',       color: 'var(--mat-sys-tertiary)',  description: 'Derived writable signal that resets when source changes' },
        { name: 'afterRenderEffect()',               icon: 'brush',      color: 'var(--mat-sys-primary)',   description: 'Post-render DOM effects replacing constructor effect()'  },
        { name: 'provideAppInitializer()',           icon: 'start',      color: 'var(--mat-sys-secondary)', description: 'Cleaner app init replacing APP_INITIALIZER token'        },
    ];

    /**
     * model() two-way binding demo:
     * highlightedCard syncs with StatCardComponent.highlighted via [(highlighted)].
     * When any card is clicked, model() updates both this signal and the child signal.
     */
    readonly highlightedCard = signal(false);

    /**
     * viewChild() — typed signal reference to the action card DOM element.
     * Unlike @ViewChild, this resolves as a signal — no AfterViewInit needed.
     */
    readonly actionCardRef = viewChild<ElementRef>('actionCard');

    private readonly router = inject(Router);

    goToCompiler(): void {
        this.router.navigate(['/compiler']);
    }

    onStatCardClicked(label: string): void {
        console.log(`[Home] Stat card clicked: ${label}`);
        // Scroll to action card using the viewChild() signal reference
        this.actionCardRef()?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }
}

