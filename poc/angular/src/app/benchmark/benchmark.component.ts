/**
 * Angular PoC - Benchmark Component
 *
 * Angular 21 patterns demonstrated:
 *
 * linkedSignal() — stable v19+
 *   selectedTransformations resets to sensible defaults whenever the run-count
 *   preset changes. The user can still tick/untick checkboxes after selecting a
 *   preset — the linked signal is a WritableSignal, not a pure computed().
 *
 * afterRenderEffect() — new in v20, stable v21
 *   Correct API for side-effects that need to read/write the DOM (measurements,
 *   third-party chart/table integrations). Runs after each render is committed
 *   to the DOM. Unlike effect() in the constructor, it is safe to query
 *   nativeElement dimensions here because the layout is guaranteed to be complete.
 *
 * viewChild() — stable v17.3+
 *   Signal-based @ViewChild replacement. Used to get the table element ref for
 *   the afterRenderEffect() DOM measurement.
 *
 * @defer — stable v17+
 *   The summary statistics card is wrapped in a @defer block with an 'on idle'
 *   trigger, so its rendering is deferred until the browser has spare capacity.
 */

import { Component, ElementRef, afterRenderEffect, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CompilerService } from '../services/compiler.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** An individual benchmark run result */
interface BenchmarkRun {
    readonly run: number;
    readonly durationMs: number;
    readonly ruleCount: number;
    readonly status: 'success' | 'error';
}

/** Preset: run-count → default transformation set */
interface RunPreset {
    readonly count: number;
    readonly defaultTransformations: string[];
}

/**
 * BenchmarkComponent
 * Showcases linkedSignal(), afterRenderEffect(), viewChild(), and @defer.
 */
@Component({
    selector: 'app-benchmark',
    standalone: true,
    imports: [
        FormsModule,
        DecimalPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatFormFieldModule,
        MatCheckboxModule,
        MatProgressBarModule,
        MatTableModule,
        MatChipsModule,
        MatDividerModule,
        MatProgressSpinnerModule,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">📊 Benchmark</h1>
        <p class="subtitle mat-body-1">
            Measure compilation API performance using <code>performance.now()</code>
        </p>

        <!-- Configuration -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>tune</mat-icon>
                <mat-card-title>Configuration</mat-card-title>
                <mat-card-subtitle>
                    Selecting a run preset resets the transformation defaults via
                    <code>linkedSignal()</code>
                </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <div class="config-row">
                    <!--
                        Run count dropdown. Changing this value updates runCount and,
                        via linkedSignal(), resets selectedTransformations to the preset defaults.
                    -->
                    <mat-form-field appearance="outline">
                        <mat-label>Run preset</mat-label>
                        <mat-select
                            [ngModel]="runCount()"
                            (ngModelChange)="runCount.set($event)"
                            [disabled]="running()"
                        >
                            @for (p of runPresets; track p.count) {
                                <mat-option [value]="p.count">{{ p.count }} run{{ p.count > 1 ? 's' : '' }}</mat-option>
                            }
                        </mat-select>
                    </mat-form-field>
                </div>

                <p class="mat-caption mt-1">
                    <strong>linkedSignal() demo:</strong> when the run count preset changes,
                    <code>selectedTransformations</code> resets to the defaults for that preset.
                    You can still check/uncheck individual transformations afterwards.
                </p>

                <div class="transformations-grid mt-2">
                    @for (name of transformationNames; track name) {
                        <mat-checkbox
                            [checked]="selectedTransformations().includes(name)"
                            (change)="toggleTransformation(name)"
                            [disabled]="running()"
                        >{{ name }}</mat-checkbox>
                    }
                </div>
            </mat-card-content>
            <mat-card-actions>
                <button mat-raised-button color="primary"
                    (click)="handleRunBenchmark()" [disabled]="running()">
                    @if (running()) {
                        <mat-spinner diameter="20"></mat-spinner>
                        Running… ({{ runs().length }}/{{ runCount() }})
                    } @else {
                        <mat-icon>play_arrow</mat-icon> Run Benchmark
                    }
                </button>
            </mat-card-actions>
        </mat-card>

        <!-- Progress Bar -->
        @if (running()) {
            <mat-progress-bar mode="determinate" [value]="progressPercent()" class="mb-2" />
        }

        <!-- Results Table -->
        @if (runs().length > 0) {
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar>table_chart</mat-icon>
                    <mat-card-title>Results</mat-card-title>
                    <mat-card-subtitle>{{ runs().length }} runs completed</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <!--
                        #benchmarkTable — viewChild() target.
                        afterRenderEffect() reads its offsetHeight after each render.
                    -->
                    <table #benchmarkTable mat-table [dataSource]="runs()" class="benchmark-table w-full">
                        <ng-container matColumnDef="run">
                            <th mat-header-cell *matHeaderCellDef>Run #</th>
                            <td mat-cell *matCellDef="let row">{{ row.run }}</td>
                        </ng-container>
                        <ng-container matColumnDef="duration">
                            <th mat-header-cell *matHeaderCellDef>Duration (ms)</th>
                            <td mat-cell *matCellDef="let row">{{ row.durationMs }} ms</td>
                        </ng-container>
                        <ng-container matColumnDef="rulesPerSec">
                            <th mat-header-cell *matHeaderCellDef>Rules/sec</th>
                            <td mat-cell *matCellDef="let row">
                                {{ row.durationMs > 0 ? ((row.ruleCount / row.durationMs) * 1000 | number:'1.0-0') : '—' }}
                            </td>
                        </ng-container>
                        <ng-container matColumnDef="status">
                            <th mat-header-cell *matHeaderCellDef>Status</th>
                            <td mat-cell *matCellDef="let row">
                                <mat-icon [color]="row.status === 'success' ? 'primary' : 'warn'">
                                    {{ row.status === 'success' ? 'check_circle' : 'error' }}
                                </mat-icon>
                            </td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                    </table>

                    <!-- afterRenderEffect() measurement display -->
                    @if (tableHeight() > 0) {
                        <p class="mat-caption mt-1 table-height-note">
                            <code>afterRenderEffect()</code> measured table height: <strong>{{ tableHeight() }}px</strong>
                        </p>
                    }
                </mat-card-content>
            </mat-card>

            <!--
                @defer with 'on idle' trigger.
                The summary statistics card is deferred until the browser is idle
                (requestIdleCallback). This prevents layout work during active benchmark runs.
            -->
            @defer (on idle) {
                @if (!running()) {
                    <mat-card appearance="outlined" class="mb-2">
                        <mat-card-header>
                            <mat-icon mat-card-avatar>summarize</mat-icon>
                            <mat-card-title>Summary Statistics</mat-card-title>
                            <mat-card-subtitle>Rendered lazily via <code>&#64;defer (on idle)</code></mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-content>
                            <mat-divider class="mt-1 mb-2"></mat-divider>
                            <div class="summary-grid">
                                <div class="summary-item">
                                    <div class="summary-value">{{ summary().min }} ms</div>
                                    <div class="summary-label mat-caption">Min</div>
                                </div>
                                <div class="summary-item">
                                    <div class="summary-value">{{ summary().max }} ms</div>
                                    <div class="summary-label mat-caption">Max</div>
                                </div>
                                <div class="summary-item">
                                    <div class="summary-value">{{ summary().avg }} ms</div>
                                    <div class="summary-label mat-caption">Avg</div>
                                </div>
                                <div class="summary-item">
                                    <div class="summary-value">{{ runs().length }}</div>
                                    <div class="summary-label mat-caption">Runs</div>
                                </div>
                            </div>
                        </mat-card-content>
                    </mat-card>
                }
            } @placeholder {
                <mat-card appearance="outlined" class="mb-2">
                    <mat-card-content class="placeholder-content">
                        <mat-spinner diameter="24"></mat-spinner>
                        <span class="mat-caption">Computing summary…</span>
                    </mat-card-content>
                </mat-card>
            }
        }

        <!-- Info card -->
        <mat-card appearance="outlined" class="info-card">
            <mat-card-header>
                <mat-icon mat-card-avatar>info</mat-icon>
                <mat-card-title>Angular 21 Patterns Used Here</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <div class="pattern-list">
                    <div class="pattern-item">
                        <code>linkedSignal()</code>
                        <span>selectedTransformations auto-resets when runCount preset changes</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="pattern-item">
                        <code>afterRenderEffect()</code>
                        <span>Table height measured post-render via viewChild() — safe DOM access</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="pattern-item">
                        <code>viewChild()</code>
                        <span>Signal reference to #benchmarkTable native element</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="pattern-item">
                        <code>&#64;defer (on idle)</code>
                        <span>Summary card renders lazily when browser is idle</span>
                    </div>
                </div>
            </mat-card-content>
        </mat-card>
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .config-row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .transformations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .benchmark-table { width: 100%; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; }
    .summary-item { text-align: center; padding: 16px; background: var(--mat-sys-surface-variant); border-radius: 8px; }
    .summary-value { font-size: 1.5rem; font-weight: 700; color: var(--mat-sys-primary); }
    .summary-label { color: var(--mat-sys-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .info-card { background-color: var(--mat-sys-surface-variant); }
    .table-height-note { color: var(--mat-sys-on-surface-variant); }
    .placeholder-content { display: flex; align-items: center; gap: 16px; padding: 16px; }
    .pattern-list { display: flex; flex-direction: column; gap: 8px; }
    .pattern-item { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
    .pattern-item code { font-weight: 700; font-size: 0.95em; }
    .pattern-item span { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
  `],
})
export class BenchmarkComponent {
    readonly transformationNames: string[] = [
        'RemoveComments',
        'Deduplicate',
        'TrimLines',
        'RemoveEmptyLines',
        'Validate',
        'Compress',
    ];

    /** Run-count presets — each has a different default transformation set */
    readonly runPresets: RunPreset[] = [
        { count: 1,  defaultTransformations: ['RemoveComments']                              },
        { count: 5,  defaultTransformations: ['RemoveComments', 'Deduplicate']               },
        { count: 10, defaultTransformations: ['RemoveComments', 'Deduplicate', 'TrimLines']  },
        { count: 20, defaultTransformations: ['RemoveComments', 'Deduplicate', 'TrimLines', 'RemoveEmptyLines'] },
    ];

    readonly displayedColumns: string[] = ['run', 'duration', 'rulesPerSec', 'status'];

    /** Source signal that drives linkedSignal() */
    readonly runCount = signal<number>(5);
    readonly running  = signal<boolean>(false);
    readonly runs     = signal<BenchmarkRun[]>([]);

    /**
     * linkedSignal() — stable v19+
     *
     * selectedTransformations resets to the preset defaults whenever runCount changes.
     * Unlike computed(), it is a WritableSignal — the user can toggle checkboxes
     * after selecting a preset and those overrides are preserved until the next preset change.
     *
     * Old pattern (effect writing a signal — not recommended):
     *   effect(() => { this.selectedTransformations.set(defaultsFor(this.runCount())); });
     *
     * New pattern (declarative, no effect needed):
     *   selectedTransformations = linkedSignal(() => defaultsFor(this.runCount()));
     */
    readonly selectedTransformations = linkedSignal<string[]>(() => {
        const preset = this.runPresets.find(p => p.count === this.runCount());
        return preset?.defaultTransformations ?? ['RemoveComments', 'Deduplicate'];
    });

    readonly progressPercent = computed(() =>
        this.runCount() > 0 ? Math.round((this.runs().length / this.runCount()) * 100) : 0,
    );

    readonly summary = computed(() => {
        const r = this.runs();
        if (!r.length) return { min: 0, max: 0, avg: 0 };
        const d = r.map(x => x.durationMs);
        return {
            min: Math.min(...d),
            max: Math.max(...d),
            avg: Math.round(d.reduce((a, b) => a + b, 0) / d.length),
        };
    });

    /**
     * viewChild() — stable v17.3+
     * Typed signal reference to the <table #benchmarkTable> element.
     * Replaces: @ViewChild('benchmarkTable') tableRef!: ElementRef;
     */
    readonly benchmarkTableRef = viewChild<ElementRef>('benchmarkTable');

    /**
     * afterRenderEffect() — new in v20, stable v21
     *
     * Correct hook for reading DOM layout properties. Runs after every render
     * cycle in which the component's view is updated, guaranteeing that
     * offsetHeight reflects the committed layout — unlike effect() in the
     * constructor which runs before Angular flushes to the DOM.
     *
     * Use cases: chart/table measurements, focus management, scroll positioning,
     * third-party library integrations (e.g. updating a Canvas after re-render).
     */
    readonly tableHeight = signal(0);

    private readonly compilerService = inject(CompilerService);

    constructor() {
        afterRenderEffect(() => {
            const el = this.benchmarkTableRef()?.nativeElement as HTMLElement | undefined;
            if (el) {
                this.tableHeight.set(el.offsetHeight);
            }
        });
    }

    toggleTransformation(name: string): void {
        this.selectedTransformations.update(prev =>
            prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name],
        );
    }

    async handleRunBenchmark(): Promise<void> {
        this.running.set(true);
        this.runs.set([]);

        for (let i = 1; i <= this.runCount(); i++) {
            const start = performance.now();
            let durationMs: number;
            let ruleCount = 0;
            let status: 'success' | 'error' = 'success';

            try {
                const response = await fetch('/api/compile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        configuration: {
                            name: `Benchmark Run ${i}`,
                            sources: [{ source: 'https://easylist.to/easylist/easylist.txt' }],
                            transformations: this.selectedTransformations(),
                        },
                        benchmark: true,
                    }),
                });
                durationMs = Math.round(performance.now() - start);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json() as { ruleCount?: number };
                ruleCount = data.ruleCount ?? 0;
            } catch {
                durationMs = Math.round(performance.now() - start);
                ruleCount = 1234;
                status = 'error';
            }

            this.runs.update(prev => [...prev, { run: i, durationMs, ruleCount, status }]);
        }

        this.running.set(false);
    }
}

