/**
 * QueueChartComponent — SVG-based line chart for queue statistics.
 *
 * Renders a simple, self-contained SVG chart that visualises numeric
 * data points over time.  No external charting library required.
 *
 * Inputs (all signal-based):
 *   - dataPoints: number[]   – Y-axis values
 *   - label:      string     – chart title / legend label
 *   - color:      string     – stroke colour (CSS custom property or hex)
 *   - height:     number     – SVG viewport height (default 180)
 *   - width:      number     – SVG viewport width  (default 400)
 *
 * Angular 21 patterns: input(), computed(), @if control flow.
 */

import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
    selector: 'app-queue-chart',
    imports: [MatCardModule],
    template: `
        <mat-card appearance="outlined" class="queue-chart-card">
            @if (label()) {
                <mat-card-header>
                    <mat-card-title class="chart-label">{{ label() }}</mat-card-title>
                </mat-card-header>
            }
            <mat-card-content>
            <svg [attr.viewBox]="viewBox()" preserveAspectRatio="xMidYMid meet"
                class="chart-svg" [style.max-height.px]="height()"
                [attr.aria-label]="label() || 'Queue depth chart'">
                <!-- Grid lines -->
                @for (y of gridLines(); track y) {
                    <line [attr.x1]="padding" [attr.x2]="innerWidth()"
                        [attr.y1]="y" [attr.y2]="y"
                        class="grid-line" />
                }
                <!-- Axis labels -->
                @for (tick of yTicks(); track tick.y) {
                    <text [attr.x]="padding - 6" [attr.y]="tick.y + 4"
                        class="axis-label" text-anchor="end">{{ tick.label }}</text>
                }
                <!-- Data line -->
                @if (polylinePoints().length > 1) {
                    <!-- Area fill -->
                    <polygon [attr.points]="areaPoints()" class="chart-area"
                        [style.fill]="color()" />
                    <!-- Line stroke -->
                    <polyline [attr.points]="linePoints()" class="chart-line"
                        [style.stroke]="color()" />
                }
                <!-- Data dots -->
                @for (pt of polylinePoints(); track $index) {
                    <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3"
                        class="chart-dot" [style.fill]="color()">
                        <title>{{ pt.value }}</title>
                    </circle>
                }
                <!-- Empty state -->
                @if (polylinePoints().length === 0) {
                    <text [attr.x]="width() / 2" [attr.y]="height() / 2"
                        text-anchor="middle" class="empty-label">No data</text>
                }
            </svg>
            </mat-card-content>
        </mat-card>
    `,
    styles: [`
        .queue-chart-card {
            display: flex;
            flex-direction: column;
        }
        .chart-label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--mat-sys-secondary, #625b71);
        }
        .chart-svg {
            width: 100%;
            overflow: visible;
        }
        .grid-line {
            stroke: var(--app-border, #e0e0e0);
            stroke-width: 0.5;
            stroke-dasharray: 4 2;
        }
        .axis-label {
            font-size: 10px;
            fill: var(--app-text-secondary, #999);
        }
        .chart-line {
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .chart-area {
            opacity: 0.12;
        }
        .chart-dot {
            stroke: var(--app-surface, #fff);
            stroke-width: 1.5;
            cursor: pointer;
            transition: r 0.15s ease;
        }
        .chart-dot:hover { r: 5; }
        .empty-label {
            font-size: 14px;
            fill: var(--app-text-secondary, #999);
        }
    `],
})
export class QueueChartComponent {
    readonly dataPoints = input<number[]>([]);
    readonly label = input('');
    readonly color = input('var(--mat-sys-primary, #6750a4)');
    readonly height = input(180);
    readonly width = input(400);

    readonly padding = 40;
    private readonly topPad = 16;
    private readonly bottomPad = 8;

    readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);

    readonly innerWidth = computed(() => this.width() - this.padding);
    private readonly innerHeight = computed(() => this.height() - this.topPad - this.bottomPad);

    private readonly maxValue = computed(() => {
        const pts = this.dataPoints();
        if (pts.length === 0) return 1;
        return Math.max(...pts, 1); // avoid division by zero
    });

    /** Projected SVG coordinates for each data point */
    readonly polylinePoints = computed(() => {
        const pts = this.dataPoints();
        if (pts.length === 0) return [];

        const xStep = pts.length > 1
            ? (this.innerWidth() - this.padding) / (pts.length - 1)
            : 0;
        const maxY = this.maxValue();

        return pts.map((v, i) => ({
            x: this.padding + i * xStep,
            y: this.topPad + this.innerHeight() - (v / maxY) * this.innerHeight(),
            value: v,
        }));
    });

    /** SVG polyline points string */
    readonly linePoints = computed(() =>
        this.polylinePoints().map(p => `${p.x},${p.y}`).join(' '),
    );

    /** SVG polygon points string (closed area under the line) */
    readonly areaPoints = computed(() => {
        const pts = this.polylinePoints();
        if (pts.length < 2) return '';
        const baseline = this.topPad + this.innerHeight();
        const top = pts.map(p => `${p.x},${p.y}`).join(' ');
        const lastX = pts[pts.length - 1].x;
        const firstX = pts[0].x;
        return `${top} ${lastX},${baseline} ${firstX},${baseline}`;
    });

    /** Horizontal grid-line Y positions (4 lines evenly spaced) */
    readonly gridLines = computed(() => {
        const count = 4;
        const step = this.innerHeight() / count;
        return Array.from({ length: count + 1 }, (_, i) => this.topPad + i * step);
    });

    /** Y-axis tick labels */
    readonly yTicks = computed(() => {
        const count = 4;
        const max = this.maxValue();
        const step = this.innerHeight() / count;
        return Array.from({ length: count + 1 }, (_, i) => ({
            y: this.topPad + i * step,
            label: Math.round(max - (max / count) * i).toString(),
        }));
    });
}
