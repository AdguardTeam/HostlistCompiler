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

@Component({
    selector: 'app-skeleton-card',
    standalone: true,
    imports: [MatCardModule],
    template: `
        <mat-card appearance="outlined" class="skeleton-card">
            <mat-card-content>
                @if (showAvatar()) {
                    <div class="skeleton-avatar shimmer"></div>
                }
                @for (line of lineWidths(); track $index) {
                    <div class="skeleton-line shimmer" [style.width]="line"></div>
                }
            </mat-card-content>
        </mat-card>
    `,
    styles: [`
        .skeleton-card {
            padding: 16px;
        }
        .skeleton-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-bottom: 12px;
        }
        .skeleton-line {
            height: 14px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .skeleton-line:last-child {
            margin-bottom: 0;
        }
        .shimmer {
            background: linear-gradient(
                90deg,
                var(--mat-sys-surface-variant, #e0e0e0) 25%,
                var(--mat-sys-surface, #f5f5f5) 50%,
                var(--mat-sys-surface-variant, #e0e0e0) 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
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
