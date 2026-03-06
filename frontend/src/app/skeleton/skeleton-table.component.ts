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
                <div class="flex flex-col gap-2 py-2">
                    <!-- Header row -->
                    <div data-testid="skeleton-row-header" class="flex gap-3">
                        @for (col of columnArray(); track $index) {
                            <div data-testid="skeleton-cell" class="h-4 rounded animate-pulse bg-surface-variant opacity-80"
                                 [style.flex]="col"></div>
                        }
                    </div>
                    <!-- Body rows -->
                    @for (row of rowArray(); track $index) {
                        <div data-testid="skeleton-row" class="flex gap-3">
                            @for (col of columnArray(); track $index) {
                                <div data-testid="skeleton-cell" class="h-[14px] rounded min-w-[40px] animate-pulse bg-surface-variant"
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
    styles: [],
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
