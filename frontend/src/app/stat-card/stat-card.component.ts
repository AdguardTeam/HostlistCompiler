/**
 * Angular PoC - StatCard Component
 *
 * Angular 21 Signal Component API patterns demonstrated:
 *
 * input() / input.required() — stable v19+
 *   Replaces @Input() decorator. Returns a Signal<T> that participates in the
 *   zoneless change detection graph automatically.
 *   - input.required<T>()  → compile-time error if parent omits the binding
 *   - input<T>(defaultValue) → optional with a fallback default
 *
 * output() — stable v19+
 *   Replaces @Output() + EventEmitter. Returns an OutputEmitterRef<T>.
 *   Fire with: this.cardClicked.emit(value)
 *   Bind with: (cardClicked)="handler($event)"
 *
 * model() — stable v19+
 *   A two-way writable signal. Replaces the paired @Input() + @Output()nameChange
 *   pattern. When the parent binds [(highlighted)]="mySignal", both the parent
 *   signal and this component's model() update together.
 *   Bind with:  [(highlighted)]="someSignal"
 *   Update in component: this.highlighted.update(v => !v)
 *
 * computed() with signal inputs
 *   computed() can read input() signals — Angular tracks the dependency
 *   automatically, so the computed value recalculates whenever the input changes.
 */

import { Component, computed, input, model, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * StatCardComponent
 * A reusable statistics display card for the Home dashboard.
 *
 * Usage:
 * ```html
 * <app-stat-card
 *   label="Total Rules"
 *   value="456K"
 *   icon="rule"
 *   color="var(--mat-sys-primary)"
 *   [(highlighted)]="isCardHighlighted"
 *   (cardClicked)="onClicked($event)"
 * />
 * ```
 */
@Component({
    selector: 'app-stat-card',
    imports: [
        MatCardModule,
        MatIconModule,
        MatRippleModule,
        MatTooltipModule,
    ],
    template: `
    <mat-card
        matRipple
        appearance="outlined"
        class="stat-card"
        [class.highlighted]="highlighted()"
        (click)="handleClick()"
        [matTooltip]="'Click to highlight: ' + label()"
        role="button"
        tabindex="0"
        (keydown.enter)="handleClick()"
        (keydown.space)="handleClick()"
    >
        <mat-card-content>
            <mat-icon class="stat-icon" [style.color]="color()">{{ icon() }}</mat-icon>
            <div class="stat-value">{{ value() }}</div>
            <div class="stat-label">{{ label() }}</div>

            @if (highlighted()) {
                <mat-icon class="highlight-badge" color="primary">star</mat-icon>
            }
        </mat-card-content>
    </mat-card>
    `,
    styles: [`
    .stat-card {
        text-align: center;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        position: relative;
    }

    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--mat-sys-level3, 0 4px 12px rgba(0,0,0,0.15));
    }

    .stat-card:focus-visible {
        transform: translateY(-2px);
        box-shadow: var(--mat-sys-level3, 0 4px 12px rgba(0,0,0,0.15));
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
    }

    .stat-card.highlighted {
        border-color: var(--mat-sys-primary);
        background-color: var(--mat-sys-primary-container, rgba(var(--mat-sys-primary), 0.08));
    }

    .stat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
        /* Material Symbols variable font: match optical size to rendered size */
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
    }

    .stat-value {
        font-size: 2rem;
        font-weight: 700;
        line-height: 1.2;
        margin-bottom: 4px;
    }

    .stat-label {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
    }

    .highlight-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 18px;
        width: 18px;
        height: 18px;
    }
    `],
})
export class StatCardComponent {
    /**
     * input.required<T>() — required signal input.
     * Angular will produce a compile-time error if the parent omits `label`.
     */
    readonly label = input.required<string>();

    /**
     * input.required<T>() — required signal input.
     */
    readonly value = input.required<string>();

    /**
     * input() with a default — optional signal input.
     * Falls back to 'info' if the parent does not provide an icon name.
     */
    readonly icon = input<string>('info');

    /**
     * input() with a default — optional signal input for color.
     */
    readonly color = input<string>('var(--mat-sys-primary)');

    /**
     * model() — two-way writable signal (stable v19+).
     * Replaces the @Input() highlighted + @Output() highlightedChange pair.
     * Parent binds with: [(highlighted)]="myHighlightSignal"
     */
    readonly highlighted = model<boolean>(false);

    /**
     * output() — signal output (stable v19+).
     * Replaces @Output() cardClicked = new EventEmitter<string>().
     * Emits the card label so the parent knows which card was clicked.
     */
    readonly cardClicked = output<string>();

    /**
     * computed() reading a signal input — recalculates whenever label() changes.
     * Demonstrates that computed() participates fully in the signal graph.
     */
    readonly ariaLabel = computed(() => `Stat card: ${this.label()}, value ${this.value()}`);

    handleClick(): void {
        // model() update — propagates back to the parent's [(highlighted)] binding
        this.highlighted.update(v => !v);
        // output() emit — parent's (cardClicked) handler receives the label
        this.cardClicked.emit(this.label());
    }
}
