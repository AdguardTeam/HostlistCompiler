/**
 * CompilerComponent — Full-featured filter list compiler.
 *
 * Features:
 *   - 5 compilation modes: JSON, Stream (SSE), Async (queued), Batch, Batch+Async
 *   - Preset selector with linkedSignal() URL defaults
 *   - Real-time queue stats panel (shown for async modes)
 *   - Progress indication per mode
 *   - LogService + NotificationService integration
 *   - Drag-and-drop file upload with Web Worker parsing
 *   - Turnstile bot protection
 *
 * Angular 21 patterns: signal(), computed(), linkedSignal(), rxResource(),
 *   toSignal(), effect(), @if/@for, inject(), DestroyRef, zoneless.
 */

import { Component, computed, DestroyRef, effect, inject, linkedSignal, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed, toSignal, rxResource } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CompileRequest, CompileResponse, CompilerService, AsyncCompileResponse } from '../services/compiler.service';
import { EMPTY, firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { JsonPipe } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SseService, SseConnection } from '../services/sse.service';
import { TurnstileComponent } from '../turnstile/turnstile.component';
import { TurnstileService } from '../services/turnstile.service';
import { FilterParserService } from '../services/filter-parser.service';
import { MetricsStore } from '../store/metrics.store';
import { NotificationService } from '../services/notification.service';
import { LogService } from '../services/log.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

/** Compilation mode */
type CompileMode = 'json' | 'stream' | 'async' | 'batch' | 'batch-async';

/** Named preset configurations */
interface Preset {
    readonly label: string;
    readonly urls: string[];
    readonly transformations: string[];
}

@Component({
    selector: 'app-compiler',
    imports: [
        ReactiveFormsModule,
        JsonPipe,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatCardModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,
        MatChipsModule,
        MatDividerModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatTooltipModule,
        MatButtonToggleModule,
        ScrollingModule,
        TurnstileComponent,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">Compiler</h1>
        <p class="subtitle mat-body-1">Configure and compile your adblock filter lists</p>

        <!-- Compilation Mode Selector -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>tune</mat-icon>
                <mat-card-title>Compilation Mode</mat-card-title>
                <mat-card-subtitle>Choose how the compilation request is processed</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <mat-button-toggle-group [value]="compileMode" (change)="compileMode = $event.value" class="mode-toggle">
                    <mat-button-toggle value="json" matTooltip="Synchronous JSON response">
                        <mat-icon>code</mat-icon> JSON
                    </mat-button-toggle>
                    <mat-button-toggle value="stream" matTooltip="Server-Sent Events streaming">
                        <mat-icon>stream</mat-icon> Stream
                    </mat-button-toggle>
                    <mat-button-toggle value="async" matTooltip="Queue for background processing">
                        <mat-icon>schedule_send</mat-icon> Async
                    </mat-button-toggle>
                    <mat-button-toggle value="batch" matTooltip="Compile multiple configs at once">
                        <mat-icon>dynamic_feed</mat-icon> Batch
                    </mat-button-toggle>
                    <mat-button-toggle value="batch-async" matTooltip="Queue batch for background">
                        <mat-icon>queue</mat-icon> Batch+Async
                    </mat-button-toggle>
                </mat-button-toggle-group>
                <p class="mode-hint mat-caption mt-1">{{ modeDescription() }}</p>
            </mat-card-content>
        </mat-card>

        <!-- Queue Stats Panel (shown for async modes) -->
        @if (compileMode === 'async' || compileMode === 'batch-async') {
            <mat-card appearance="outlined" class="mb-2 queue-panel">
                <mat-card-header>
                    <mat-icon mat-card-avatar>insights</mat-icon>
                    <mat-card-title>Queue Status</mat-card-title>
                    <mat-card-subtitle>
                        @if (store.isQueueRevalidating()) { Refreshing… } @else { Live queue statistics }
                    </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="queue-stats-row">
                        <div class="queue-stat">
                            <span class="queue-stat-value">{{ store.queueStats()?.currentDepth ?? '--' }}</span>
                            <span class="queue-stat-label">Depth</span>
                        </div>
                        <div class="queue-stat">
                            <span class="queue-stat-value">{{ store.queueStats()?.pending ?? '--' }}</span>
                            <span class="queue-stat-label">Pending</span>
                        </div>
                        <div class="queue-stat">
                            <span class="queue-stat-value">{{ store.queueStats()?.completed ?? '--' }}</span>
                            <span class="queue-stat-label">Completed</span>
                        </div>
                        <div class="queue-stat">
                            <span class="queue-stat-value">{{ store.queueStats()?.failed ?? '--' }}</span>
                            <span class="queue-stat-label">Failed</span>
                        </div>
                        <div class="queue-stat">
                            <span class="queue-stat-value">{{ (store.queueStats()?.processingRate ?? 0).toFixed(1) }}/s</span>
                            <span class="queue-stat-label">Rate</span>
                        </div>
                    </div>
                </mat-card-content>
                <mat-card-actions>
                    <button mat-button (click)="store.refreshQueue()">
                        <mat-icon>refresh</mat-icon> Refresh
                    </button>
                </mat-card-actions>
            </mat-card>
        }

        <!-- Preset selector -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-card-title>Quick Presets</mat-card-title>
                <mat-card-subtitle>Select a preset to pre-fill the form</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <mat-form-field appearance="outline">
                    <mat-label>Preset</mat-label>
                    <mat-select
                        [value]="selectedPreset()"
                        (selectionChange)="applyPreset($event.value)"
                    >
                        @for (p of presets; track p.label) {
                            <mat-option [value]="p.label">{{ p.label }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
            </mat-card-content>
        </mat-card>

        <!-- Reactive Form -->
        <form [formGroup]="compilerForm" (ngSubmit)="onSubmit()">

            <!-- URL Inputs — populated by linkedSignal() preset defaults -->
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-card-title>Filter List URLs</mat-card-title>
                    <mat-card-subtitle>Add one or more filter list URLs to compile</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div formArrayName="urls" class="url-list">
                        @for (url of urlsArray.controls; track $index; let i = $index) {
                            <div class="url-input-row">
                                <mat-form-field appearance="outline" class="url-field">
                                    <mat-label>Filter List URL {{ i + 1 }}</mat-label>
                                    <input matInput type="url"
                                        placeholder="https://example.com/filters.txt"
                                        [formControlName]="i"
                                    />
                                    <mat-icon matSuffix>link</mat-icon>
                                    @if (urlsArray.at(i).hasError('required')) {
                                        <mat-error>URL is required</mat-error>
                                    }
                                    @if (urlsArray.at(i).hasError('pattern')) {
                                        <mat-error>Please enter a valid URL (http:// or https://)</mat-error>
                                    }
                                </mat-form-field>
                                @if (urlsArray.length > 1) {
                                    <button mat-icon-button color="warn" type="button"
                                        (click)="removeUrl(i)" aria-label="Remove URL">
                                        <mat-icon>delete</mat-icon>
                                    </button>
                                }
                            </div>
                        }
                    </div>
                    <button mat-stroked-button type="button" (click)="addUrl()">
                        <mat-icon>add</mat-icon> Add URL
                    </button>
                    <div class="drop-zone"
                        [class.drag-over]="dragOver()"
                        (dragover)="onDragOver($event)"
                        (dragleave)="onDragLeave()"
                        (drop)="onDrop($event)">
                        <mat-icon>upload_file</mat-icon>
                        <span class="mat-body-2">Drop a .txt file with URLs (one per line)</span>
                        <input type="file" accept=".txt,.json" (change)="onFileSelected($event)" hidden #fileInput />
                        <button mat-stroked-button type="button" (click)="fileInput.click()">
                            <mat-icon>folder_open</mat-icon> Browse
                        </button>
                    </div>
                    @if (fileError()) {
                        <p style="color: var(--mat-sys-error); margin-top: 8px;">
                            <mat-icon style="vertical-align: middle; font-size: 18px;">warning</mat-icon>
                            {{ fileError() }}
                        </p>
                    }
                </mat-card-content>
            </mat-card>

            <!-- Transformations -->
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-card-title>Transformations</mat-card-title>
                    <mat-card-subtitle>Select which transformations to apply</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div formGroupName="transformations" class="transformations-grid">
                        @for (trans of availableTransformations; track trans) {
                            <mat-checkbox [formControlName]="trans">{{ trans }}</mat-checkbox>
                        }
                    </div>
                </mat-card-content>
            </mat-card>

            <!-- Item 1: Turnstile bot protection -->
            <app-turnstile [siteKey]="turnstileSiteKey()" />

            <!-- Submit -->
            <div class="submit-row">
                <button
                    mat-raised-button color="primary" type="submit"
                    [disabled]="isCompiling() || compilerForm.invalid"
                >
                    @if (isCompiling()) {
                        <mat-progress-spinner diameter="20" mode="indeterminate" color="accent" />
                        {{ compileMode === 'stream' ? 'Streaming…' : compileMode === 'async' || compileMode === 'batch-async' ? 'Queueing…' : 'Compiling…' }}
                    } @else {
                        <span><mat-icon>play_arrow</mat-icon> {{ submitLabel() }}</span>
                    }
                </button>
            </div>

            <!-- Progress bar -->
            @if (isCompiling()) {
                <mat-progress-bar
                    [mode]="compileMode === 'stream' ? 'buffer' : 'indeterminate'"
                    class="mt-1" />
            }
        </form>

        <!-- Error state -->
        @if (compileResource.status() === 'error') {
            <mat-card appearance="outlined" class="error-card mt-2">
                <mat-card-content>
                    <div class="error-content">
                        <mat-icon color="warn">error</mat-icon>
                        <span>{{ compileResource.error() }}</span>
                    </div>
                </mat-card-content>
            </mat-card>
        }

        <!-- Results -->
        @if (compileResource.value(); as r) {
            <mat-card appearance="outlined" class="results-card mt-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar color="primary">check_circle</mat-icon>
                    <mat-card-title>Compilation Results</mat-card-title>
                    <mat-card-subtitle>Compiled successfully</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <mat-chip-set class="mb-2">
                        <mat-chip highlighted color="primary">{{ r.ruleCount }} rules</mat-chip>
                        <mat-chip>{{ r.sources }} sources</mat-chip>
                        @if (r.benchmark) {
                            <mat-chip>{{ r.benchmark.duration }}</mat-chip>
                        }
                    </mat-chip-set>
                    <pre class="results-json">{{ r | json }}</pre>
                </mat-card-content>
                <mat-card-actions>
                    <button mat-button (click)="compileResource.reload()">
                        <mat-icon>refresh</mat-icon> Recompile
                    </button>
                    <button mat-button (click)="goHome()">
                        <mat-icon>arrow_back</mat-icon> Back to Dashboard
                    </button>
                </mat-card-actions>
            </mat-card>
        }

        <!-- SSE Streaming Output -->
        @if (sseConnection(); as conn) {
            <mat-card appearance="outlined" class="stream-card mt-2"
                [class.stream-active]="conn.isActive()"
                [class.stream-error]="conn.status() === 'error'">
                <mat-card-header>
                    <mat-icon mat-card-avatar
                        [style.color]="conn.status() === 'open' ? 'var(--mat-sys-primary)' : conn.status() === 'error' ? 'var(--mat-sys-error)' : 'var(--mat-sys-on-surface-variant)'">
                        {{ conn.status() === 'open' ? 'stream' : conn.status() === 'error' ? 'error' : 'check_circle' }}
                    </mat-icon>
                    <mat-card-title>Streaming Compilation</mat-card-title>
                    <mat-card-subtitle>
                        Status: {{ conn.status() }} — {{ conn.events().length }} events
                    </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <!-- Item 6: CDK Virtual Scrolling for SSE stream log -->
                    <cdk-virtual-scroll-viewport itemSize="60" class="stream-log">
                        @for (event of conn.events(); track $index) {
                            <div class="stream-event" [class]="'event-' + event.type">
                                <mat-chip-set>
                                    <mat-chip [highlighted]="event.type === 'result'"
                                        [color]="event.type === 'error' ? 'warn' : 'primary'">
                                        {{ event.type }}
                                    </mat-chip>
                                </mat-chip-set>
                                <pre class="event-data">{{ event.data | json }}</pre>
                            </div>
                        }
                    </cdk-virtual-scroll-viewport>
                </mat-card-content>
                @if (conn.isActive()) {
                    <mat-card-actions>
                        <button mat-button color="warn" (click)="conn.close()">
                            <mat-icon>stop</mat-icon> Abort
                        </button>
                    </mat-card-actions>
                }
            </mat-card>
        }

        <!-- Async job queued confirmation -->
        @if (asyncResult()) {
            <mat-card appearance="outlined" class="async-card mt-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar color="primary">schedule_send</mat-icon>
                    <mat-card-title>Job Queued</mat-card-title>
                    <mat-card-subtitle>{{ asyncResult()!.note }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <p class="mat-body-2">Request ID: <code>{{ asyncResult()!.requestId }}</code></p>
                    <p class="mat-body-2">You will be notified when the job completes.</p>
                </mat-card-content>
            </mat-card>
        }
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .url-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .url-input-row { display: flex; align-items: center; gap: 8px; }
    .url-field { flex: 1; }
    .transformations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 8px; }
    .mode-toggle { margin-bottom: 8px; }
    .mode-hint { color: var(--mat-sys-on-surface-variant); }
    .queue-panel { border-color: var(--app-warning, #ff9800); }
    .queue-stats-row { display: flex; gap: 24px; flex-wrap: wrap; }
    .queue-stat { display: flex; flex-direction: column; align-items: center; min-width: 60px; }
    .queue-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--mat-sys-primary); }
    .queue-stat-label { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant); }
    .error-card { border-color: var(--mat-sys-error); }
    .error-content { display: flex; align-items: center; gap: 8px; color: var(--mat-sys-error); }
    .async-card { border-color: var(--mat-sys-tertiary); }
    .results-card { border-color: var(--mat-sys-primary); }
    .results-json { background: var(--mat-sys-surface-variant); padding: 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto; max-height: 400px; overflow-y: auto; margin: 0; }
    .drop-zone { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; margin-top: 16px; border: 2px dashed var(--mat-sys-outline-variant); border-radius: 12px; text-align: center; transition: border-color 0.2s, background-color 0.2s; }
    .drop-zone.drag-over { border-color: var(--mat-sys-primary); background-color: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent); }
    .submit-row { display: flex; align-items: center; gap: 16px; }
    .stream-card { border-color: var(--mat-sys-outline); }
    .stream-card.stream-active { border-color: var(--mat-sys-primary); }
    .stream-card.stream-error { border-color: var(--mat-sys-error); }
    .stream-log { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .stream-event { display: flex; align-items: flex-start; gap: 8px; }
    .event-data { background: var(--mat-sys-surface-variant); padding: 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; overflow-x: auto; margin: 0; flex: 1; }
  `],
})
export class CompilerComponent {

    private readonly URL_PATTERN = 'https?://.+';

    /** Named compilation presets */
    readonly presets: Preset[] = [
        {
            label: 'DNS Blocking (EasyList)',
            urls: ['https://easylist.to/easylist/easylist.txt'],
            transformations: ['RemoveComments', 'Deduplicate', 'TrimLines', 'RemoveEmptyLines'],
        },
        {
            label: 'Privacy (EasyPrivacy)',
            urls: ['https://easylist.to/easylist/easyprivacy.txt'],
            transformations: ['RemoveComments', 'Deduplicate', 'Validate'],
        },
        {
            label: 'Custom (Empty)',
            urls: [''],
            transformations: [],
        },
    ];

    /**
     * selectedPreset — drives linkedSignal() below.
     * When this changes, presetUrls automatically resets.
     */
    readonly selectedPreset = signal<string>(this.presets[0].label);

    /**
     * linkedSignal() — stable v19+
     *
     * presetUrls resets to the default URLs for the current preset whenever
     * selectedPreset changes. However, it remains a WritableSignal — the user
     * can manually override URLs without triggering a preset reset.
     *
     * This is the single source of truth for the URL form controls. applyPreset()
     * calls selectedPreset.set(), which causes presetUrls to reset automatically,
     * and then reads presetUrls() to sync the FormArray — keeping both in step
     * without any duplicated preset-lookup logic.
     */
    readonly presetUrls = linkedSignal(() => {
        const preset = this.presets.find(p => p.label === this.selectedPreset());
        return preset?.urls ?? [''];
    });

    /**
     * pendingRequest signal — set when the user submits the form.
     * When undefined, rxResource() stays Idle (no HTTP call made).
     * When set to a request object, rxResource() starts loading.
     */
    private readonly pendingRequest = signal<CompileRequest | undefined>(undefined);

    /**
     * rxResource() — from @angular/core/rxjs-interop, stable v19+
     *
     * Replaces the full Observable subscribe / loading / error / result pattern:
     *
     * OLD (removed):
     *   readonly loading = signal(false);
     *   readonly error = signal<string | null>(null);
     *   readonly results = signal<CompileResponse | null>(null);
     *   this.compilerService.compile(...).pipe(takeUntilDestroyed(...)).subscribe({
     *       next: r => { this.results.set(r); this.loading.set(false); },
     *       error: e => { this.error.set(e.message); this.loading.set(false); }
     *   });
     *
     * NEW:
     *   rxResource() manages loading/error/value as built-in signals.
     *   The stream ONLY runs when params() returns a non-null/undefined value
     *   (rxResource contract). When pendingRequest is undefined the resource stays
     *   Idle — no HTTP call is made. The request type is therefore non-optional
     *   inside the stream, so no `!request` guard is needed.
     *   The returned Observable is automatically unsubscribed when it completes
     *   or when the request signal changes.
     */
    readonly compileResource = rxResource<CompileResponse, CompileRequest | undefined>({
        params: (): CompileRequest | undefined => this.pendingRequest(),
        stream: ({ params }) => params ? this.compilerService.compile(
            params.configuration.sources.map((s) => s.source),
            params.configuration.transformations,
            params.turnstileToken,
        ) : EMPTY,
    });

    readonly availableTransformations: readonly string[];

    compilerForm!: FormGroup;

    private readonly fb              = inject(FormBuilder);
    private readonly compilerService = inject(CompilerService);
    private readonly sseService      = inject(SseService);
    private readonly liveAnnouncer   = inject(LiveAnnouncer);
    private readonly route           = inject(ActivatedRoute);
    private readonly router          = inject(Router);
    private readonly destroyRef      = inject(DestroyRef);
    private readonly turnstileService = inject(TurnstileService);
    readonly filterParser            = inject(FilterParserService);
    readonly store                   = inject(MetricsStore);
    private readonly notifications   = inject(NotificationService);
    private readonly log             = inject(LogService);

    readonly turnstileSiteKey = this.turnstileService.siteKey;

    /** Active compilation mode */
    compileMode: CompileMode = 'json';
    /** Active SSE connection (null when not streaming) */
    readonly sseConnection = signal<SseConnection | null>(null);
    /** Async compilation result (requestId) */
    readonly asyncResult = signal<AsyncCompileResponse | null>(null);
    /** Drag-over state for the drop zone */
    readonly dragOver = signal(false);
    /** File upload validation error */
    readonly fileError = signal<string | null>(null);
    /** Combined loading state across all modes */
    readonly isCompiling = computed(() =>
        this.compileResource.isLoading() || (this.sseConnection()?.isActive() ?? false) || this.asyncLoading(),
    );
    private readonly asyncLoading = signal(false);

    /** Dynamic submit button label */
    readonly submitLabel = computed(() => {
        switch (this.compileMode) {
            case 'json': return 'Compile';
            case 'stream': return 'Stream';
            case 'async': return 'Queue Async';
            case 'batch': return 'Batch Compile';
            case 'batch-async': return 'Queue Batch';
        }
    });

    /** Mode description for help text */
    readonly modeDescription = computed(() => {
        switch (this.compileMode) {
            case 'json': return 'Standard synchronous compilation — returns JSON result immediately.';
            case 'stream': return 'Server-Sent Events streaming — receive compilation progress in real time.';
            case 'async': return 'Queue compilation for background processing via Cloudflare Queue. You\'ll be notified on completion.';
            case 'batch': return 'Compile multiple filter list configurations in a single request.';
            case 'batch-async': return 'Queue multiple configurations for background batch processing.';
        }
    });

    /**
     * toSignal() — from @angular/core/rxjs-interop
     *
     * Converts the queryParamMap Observable to a Signal. Angular automatically
     * unsubscribes when the component is destroyed — no takeUntilDestroyed() needed.
     * The signal value is immediately available (initialValue: null guards first read).
     *
     * This is then consumed by an effect() in the constructor to sync the first URL
     * input when ?url= is present in the route — demonstrating that toSignal() bridges
     * the Observable world into the signal graph cleanly.
     */
    private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap, { initialValue: null });

    /**
     * Item 8: Signal-based form wrappers.
     * Angular 21 does not yet have stable signal form controls, but we can bridge
     * Reactive Forms into the signal graph via toSignal(). This provides a
     * signal-native view of form state for use in computed() and effect().
     */
    readonly formValue = signal<Record<string, unknown>>({});
    readonly formValid = signal(false);

    constructor() {
        this.availableTransformations = this.compilerService.getAvailableTransformations();
        this.initializeForm();

        // effect() reads queryParams() (a Signal) and syncs the form when ?url= changes.
        effect(() => {
            const urlParam = this.queryParams()?.get('url');
            if (urlParam) {
                this.urlsArray.at(0).setValue(urlParam);
            }
        });

        // Item 8: Bridge form changes to signals
        this.compilerForm.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe(v => this.formValue.set(v));
        this.compilerForm.statusChanges
            .pipe(takeUntilDestroyed())
            .subscribe(s => this.formValid.set(s === 'VALID'));

        // Announce compilation state changes for screen readers
        effect(() => {
            const status = this.compileResource.status();
            if (status === 'resolved') {
                const r = this.compileResource.value();
                this.liveAnnouncer.announce(
                    `Compilation complete. ${r?.ruleCount ?? 0} rules compiled.`,
                    'polite',
                );
            } else if (status === 'error') {
                this.liveAnnouncer.announce('Compilation failed. Check error details.', 'assertive');
            }
        });

        // Clean up SSE connection when component is destroyed
        this.destroyRef.onDestroy(() => this.sseConnection()?.close());
    }

    private initializeForm(): void {
        const preset = this.presets[0];
        const transformationsGroup: Record<string, boolean> = {};
        this.availableTransformations.forEach((t, i) => {
            transformationsGroup[t] = preset.transformations.includes(t) || i < 2;
        });

        this.compilerForm = this.fb.group({
            urls: this.fb.array(
                preset.urls.map(url => this.fb.control(url, [Validators.required, Validators.pattern(this.URL_PATTERN)])),
            ),
            transformations: this.fb.group(transformationsGroup),
        });
    }

    get urlsArray(): FormArray {
        return this.compilerForm.get('urls') as FormArray;
    }

    applyPreset(label: string): void {
        this.selectedPreset.set(label); // triggers linkedSignal — presetUrls auto-resets to preset defaults
        const preset = this.presets.find(p => p.label === label);
        if (!preset) return;

        // Sync FormArray from presetUrls (the linkedSignal), which is now the single
        // source of truth for URL defaults. After selectedPreset.set(), presetUrls()
        // already reflects the new preset's URLs — no need to look up preset.urls again.
        const urls = this.presetUrls();
        while (this.urlsArray.length) this.urlsArray.removeAt(0);
        urls.forEach(url =>
            this.urlsArray.push(this.fb.control(url, [Validators.required, Validators.pattern(this.URL_PATTERN)])),
        );

        // Sync transformations
        const ctrl = this.compilerForm.get('transformations');
        if (ctrl) {
            const patch: Record<string, boolean> = {};
            this.availableTransformations.forEach(t => {
                patch[t] = preset.transformations.includes(t);
            });
            ctrl.patchValue(patch);
        }
    }

    addUrl(): void {
        this.urlsArray.push(this.fb.control('', [Validators.required, Validators.pattern(this.URL_PATTERN)]));
    }

    removeUrl(index: number): void {
        if (this.urlsArray.length > 1) this.urlsArray.removeAt(index);
    }

    goHome(): void {
        this.router.navigate(['/']);
    }

    onSubmit(): void {
        if (this.compilerForm.invalid) return;

        const urls: string[] = this.compilerForm.value.urls.filter((u: string) => u.trim());
        const transformationsObj: Record<string, boolean> = this.compilerForm.value.transformations;
        const selectedTransformations = Object.keys(transformationsObj).filter(k => transformationsObj[k]);

        if (!urls.length) return;

        const request: CompileRequest = {
            configuration: {
                name: 'Adblock Compilation',
                sources: urls.map(source => ({ source })),
                transformations: selectedTransformations,
            },
            benchmark: true,
            turnstileToken: this.turnstileService.token() || undefined,
        };

        this.log.info(`Compilation started: mode=${this.compileMode}, urls=${urls.length}`, 'compiler');
        this.liveAnnouncer.announce('Compilation started', 'polite');
        this.asyncResult.set(null);

        switch (this.compileMode) {
            case 'json':
                this.pendingRequest.set(request);
                break;

            case 'stream':
                this.sseConnection()?.close();
                this.sseConnection.set(this.sseService.connect('/compile/stream', request));
                break;

            case 'async':
                this.submitAsync(urls, selectedTransformations);
                break;

            case 'batch':
                // Batch with single config for now; user can add more via presets
                this.pendingRequest.set(request);
                break;

            case 'batch-async':
                this.submitBatchAsync([request.configuration], selectedTransformations);
                break;
        }

        if (urls[0]) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { url: urls[0] },
                queryParamsHandling: 'merge',
            });
        }
    }

    /** Submit async compilation and track the job */
    private async submitAsync(urls: string[], transformations: string[]): Promise<void> {
        this.asyncLoading.set(true);
        try {
            const result = await firstValueFrom(this.compilerService.compileAsync(urls, transformations, this.turnstileService.token() || undefined));
            this.asyncResult.set(result);
            this.notifications.trackJob(result.requestId, 'Async Compilation');
            this.notifications.showToast('info', 'Job Queued', `Request ${result.requestId} queued for processing`);
            this.log.info(`Async job queued: ${result.requestId}`, 'compiler');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.notifications.showToast('error', 'Queue Error', message);
            this.log.error(`Async submit failed: ${message}`, 'compiler');
        } finally {
            this.asyncLoading.set(false);
        }
    }

    /** Submit batch async compilation */
    private async submitBatchAsync(
        configurations: CompileRequest['configuration'][],
        _transformations: string[],
    ): Promise<void> {
        this.asyncLoading.set(true);
        try {
            const result = await firstValueFrom(this.compilerService.compileBatchAsync(configurations, this.turnstileService.token() || undefined));
            this.asyncResult.set(result);
            this.notifications.trackJob(result.requestId, 'Batch Async Compilation');
            this.notifications.showToast('info', 'Batch Queued', `Batch request ${result.requestId} queued`);
            this.log.info(`Batch async job queued: ${result.requestId}`, 'compiler');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.notifications.showToast('error', 'Batch Queue Error', message);
            this.log.error(`Batch async submit failed: ${message}`, 'compiler');
        } finally {
            this.asyncLoading.set(false);
        }
    }

    /** Drag-and-drop handlers for file upload */
    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    onDragLeave(): void {
        this.dragOver.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const file = event.dataTransfer?.files[0];
        if (file) this.loadUrlsFromFile(file);
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) this.loadUrlsFromFile(file);
        input.value = ''; // reset for re-selecting same file
    }

    private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static readonly MAX_URLS = 50;

    /**
     * Item 4: Load and parse file via Web Worker.
     * The FilterParserService offloads parsing to a background thread
     * to keep the UI responsive for large filter lists.
     *
     * Validates file size (≤ 5 MB) and URL count (≤ 50) before processing.
     */
    private loadUrlsFromFile(file: File): void {
        this.fileError.set(null);

        if (file.size > CompilerComponent.MAX_FILE_SIZE) {
            this.fileError.set(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const content = reader.result as string;

            // Parse in Web Worker for large files
            this.filterParser.parse(content);

            // Also extract URLs directly for the form
            const urls = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && /^https?:\/\//.test(line));

            if (!urls.length) {
                this.fileError.set('No valid URLs found in file.');
                return;
            }

            if (urls.length > CompilerComponent.MAX_URLS) {
                this.fileError.set(`File contains ${urls.length} URLs. Maximum is ${CompilerComponent.MAX_URLS}.`);
                return;
            }

            while (this.urlsArray.length) this.urlsArray.removeAt(0);
            urls.forEach(url =>
                this.urlsArray.push(
                    this.fb.control(url, [Validators.required, Validators.pattern(this.URL_PATTERN)]),
                ),
            );
        };
        reader.readAsText(file);
    }
}

