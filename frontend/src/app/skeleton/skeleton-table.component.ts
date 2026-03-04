/**
 * SkeletonTableComponent — Shimmer loading placeholder for tables.
 *
 * Renders a configurable grid of shimmer lines that mimic a data table.
 *
 * Angular 21 patterns: input() with defaults, computed(), standalone component
 */

import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
    selector: 'app-skeleton-table',
    standalone: true,
    imports: [MatCardModule, MatProgressBarModule],
    template: `
        <mat-card appearance="outlined">
            <mat-progress-bar mode="buffer" bufferValue="0" />
            <mat-card-content>
                <div class="skeleton-table">
                    <!-- Header row -->
                    <div class="skeleton-row header">
                        @for (col of columnArray(); track $index) {
                            <div class="skeleton-cell shimmer" [style.flex]="col"></div>
                        }
                    </div>
                    <!-- Body rows -->
                    @for (row of rowArray(); track $index) {
                        <div class="skeleton-row">
                            @for (col of columnArray(); track $index) {
                                <div class="skeleton-cell shimmer"
                                    [style.flex]="col"
                                    [style.width]="getCellWidth($index, row)">
                                </div>
                            }
                        </div>
                    }
                </div>
            </mat-card-content>
        </mat-card>
    `,
    styles: [`
        .skeleton-table {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 8px 0;
        }
        .skeleton-row {
            display: flex;
            gap: 12px;
        }
        .skeleton-row.header .skeleton-cell {
            height: 16px;
            opacity: 0.8;
        }
        .skeleton-cell {
            height: 14px;
            border-radius: 4px;
            min-width: 40px;
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
export class SkeletonTableComponent {
    /** Number of data rows */
    readonly rows = input<number>(5);
    /** Number of columns */
    readonly columns = input<number>(4);

    readonly rowArray = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
    readonly columnArray = computed(() => Array.from({ length: this.columns() }, (_, i) => i + 1));

    getCellWidth(colIndex: number, _row: number): string {
        // Vary widths for natural appearance
        const widths = ['90%', '70%', '85%', '60%', '75%'];
        return widths[(colIndex + _row) % widths.length];
    }
}
