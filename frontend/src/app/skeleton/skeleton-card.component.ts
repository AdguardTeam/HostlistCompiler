/**
 * SkeletonCardComponent — Shimmer loading placeholder for card layouts.
 *
 * Replaces <mat-spinner> with a more visually polished skeleton loader.
 * Configurable number of lines and optional icon/avatar placeholder.
 *
 * Angular 21 patterns: input() with defaults, standalone component
 */

import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
    selector: 'app-skeleton-card',
    standalone: true,
    imports: [MatCardModule, MatProgressBarModule],
    template: `
        <mat-card appearance="outlined" class="skeleton-card">
            <mat-progress-bar mode="buffer" bufferValue="0" class="skeleton-progress" />
            <mat-card-content>
                @if (showAvatar()) {
                    <div data-testid="skeleton-avatar" class="size-10 rounded-full mb-3 animate-pulse bg-[var(--mat-sys-surface-variant)]"></div>
                }
                @for (line of lineWidths(); track $index) {
                    <div data-testid="skeleton-line" class="h-[14px] rounded mb-[10px] last:mb-0 animate-pulse bg-[var(--mat-sys-surface-variant)]"
                         [style.width]="line"></div>
                }
            </mat-card-content>
        </mat-card>
    `,
    styles: [`
        .skeleton-card { padding: 16px; }
    `],
})
export class SkeletonCardComponent {
    /** Number of placeholder text lines */
    readonly lines = input<number>(3);
    /** Whether to show a circular avatar placeholder */
    readonly showAvatar = input<boolean>(false);

    /** Generate varying widths for a natural look */
    readonly lineWidths = input<string[]>(['100%', '85%', '60%']);
}
