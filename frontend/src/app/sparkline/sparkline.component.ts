/**
 * SparklineComponent — Lightweight Canvas-based sparkline chart.
 *
 * Draws a mini line chart using the Canvas 2D API. No external chart
 * library needed. Uses afterRenderEffect() for safe DOM interaction
 * and viewChild() for the canvas reference.
 *
 * Angular 21 patterns: input(), viewChild(), afterRenderEffect(),
 *   computed(), standalone component
 */

import { Component, afterRenderEffect, computed, input, viewChild, ElementRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
    selector: 'app-sparkline',
    standalone: true,
    imports: [MatCardModule],
    template: `
        <mat-card appearance="outlined" class="sparkline-card">
            <mat-card-content>
                <canvas #canvas
                    [width]="width()"
                    [height]="height()"
                    class="sparkline-canvas"
                    [attr.aria-label]="ariaLabel()">
                </canvas>
            </mat-card-content>
        </mat-card>
    `,
    styles: [`
        .sparkline-canvas {
            display: block;
            border-radius: 4px;
        }
    `],
})
export class SparklineComponent {
    /** Data points to plot */
    readonly data = input<number[]>([]);
    /** Canvas width in pixels */
    readonly width = input<number>(120);
    /** Canvas height in pixels */
    readonly height = input<number>(32);
    /** Line/fill color */
    readonly color = input<string>('var(--mat-sys-primary, #1976d2)');
    /** Whether to fill under the line */
    readonly fill = input<boolean>(true);
    /** Accessibility label */
    readonly label = input<string>('Sparkline chart');

    readonly ariaLabel = computed(() => {
        const d = this.data();
        if (!d.length) return this.label();
        return `${this.label()}: min ${Math.min(...d)}, max ${Math.max(...d)}, latest ${d[d.length - 1]}`;
    });

    private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

    constructor() {
        afterRenderEffect(() => {
            this.draw();
        });
    }

    /** Normalize data points to [0,1] range */
    static normalize(data: number[]): number[] {
        if (data.length === 0) return [];
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        return data.map(v => (v - min) / range);
    }

    private draw(): void {
        const canvas = this.canvasRef()?.nativeElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const d = this.data();
        const w = this.width();
        const h = this.height();
        const padding = 2;

        ctx.clearRect(0, 0, w, h);
        if (d.length < 2) return;

        const normalized = SparklineComponent.normalize(d);
        const stepX = (w - padding * 2) / (normalized.length - 1);
        const drawH = h - padding * 2;

        // Resolve CSS variable color
        const color = this.resolveColor(this.color());

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        normalized.forEach((val, i) => {
            const x = padding + i * stepX;
            const y = padding + drawH - val * drawH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill area under line
        if (this.fill()) {
            ctx.lineTo(padding + (normalized.length - 1) * stepX, h);
            ctx.lineTo(padding, h);
            ctx.closePath();
            ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb(', 'rgba(');
            // Fallback for hex colors
            ctx.globalAlpha = 0.15;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    private resolveColor(cssColor: string): string {
        // For CSS variables, try to resolve from computed styles
        if (cssColor.startsWith('var(')) {
            try {
                const canvas = this.canvasRef()?.nativeElement;
                if (canvas) {
                    const computed = getComputedStyle(canvas);
                    const varName = cssColor.match(/var\(([^,)]+)/)?.[1]?.trim();
                    if (varName) {
                        const resolved = computed.getPropertyValue(varName).trim();
                        if (resolved) return resolved;
                    }
                }
            } catch { /* fallback */ }
            // Fallback from var() declaration
            const fallback = cssColor.match(/,\s*([^)]+)\)/)?.[1]?.trim();
            return fallback || '#1976d2';
        }
        return cssColor;
    }
}
