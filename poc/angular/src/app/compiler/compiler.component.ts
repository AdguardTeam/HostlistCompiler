/**
 * Angular PoC - Compiler Form Component
 *
 * Angular 21 patterns demonstrated:
 *
 * resource() — stable v19+
 *   Signal-native async data primitive. Replaces the loading/error/result signal
 *   trio + manual subscribe/unsubscribe boilerplate. A resource has:
 *     .value()     — Signal<T | undefined> — current resolved data
 *     .status()    — Signal<ResourceStatus> — Idle / Loading / Resolved / Error / Local
 *     .error()     — Signal<unknown>        — thrown error (if any)
 *     .isLoading() — Signal<boolean>        — convenience alias
 *     .reload()    — triggers a fresh load with the same request
 *   The loader only runs when request() returns a non-undefined value, so setting
 *   pendingRequest to undefined effectively "pauses" the resource.
 *
 * rxResource() — from @angular/core/rxjs-interop, stable v19+
 *   Same as resource() but the loader returns an Observable instead of a Promise.
 *   Ideal for keeping the existing CompilerService (which returns Observable) while
 *   consuming the result as a signal in the template.
 *
 * linkedSignal() — stable v19+
 *   A writable signal whose value automatically resets when a source signal changes.
 *   Used here for preset-driven URL defaults: when the user picks a preset, the URL
 *   list resets to the preset's defaults — but can still be manually overridden.
 *
 * toSignal() — from @angular/core/rxjs-interop
 *   Bridges an Observable to a Signal. Automatically unsubscribes when the component
 *   is destroyed — no takeUntilDestroyed() needed.
 *
 * takeUntilDestroyed() — from @angular/core/rxjs-interop
 *   Declarative subscription teardown; still used for the query-param side-effect.
 */

import { Component, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal, rxResource } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CompileRequest, CompileResponse, CompilerService } from '../services/compiler.service';
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
import { ResourceStatus } from '@angular/core';

/** Named preset configurations */
interface Preset {
    readonly label: string;
    readonly urls: string[];
    readonly transformations: string[];
}

/**
 * CompilerComponent
 * Demonstrates resource(), rxResource(), linkedSignal(), and toSignal().
 */
@Component({
    selector: 'app-compiler',
    standalone: true,
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
        MatChipsModule,
        MatDividerModule,
        MatSelectModule,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">Compiler</h1>
        <p class="subtitle mat-body-1">Configure and compile your adblock filter lists</p>

        <!-- Preset selector — drives linkedSignal() URL defaults -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-card-title>Quick Presets</mat-card-title>
                <mat-card-subtitle>
                    Select a preset to pre-fill the form.
                    <code>linkedSignal()</code> resets URLs when the preset changes,
                    but you can still edit them manually.
                </mat-card-subtitle>
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

            <!-- Submit -->
            <button
                mat-raised-button color="primary" type="submit"
                [disabled]="compileResource.isLoading() || compilerForm.invalid"
            >
                @if (compileResource.isLoading()) {
                    <mat-progress-spinner diameter="20" mode="indeterminate" color="accent" />
                    Compiling…
                } @else {
                    <mat-icon>play_arrow</mat-icon> Compile
                }
            </button>
        </form>

        <!-- resource() status display -->
        <mat-card appearance="outlined" class="resource-status-card mt-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>info</mat-icon>
                <mat-card-title>resource() Status</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <mat-chip-set>
                    <mat-chip [highlighted]="compileResource.status() === ResourceStatus.Idle">Idle</mat-chip>
                    <mat-chip [highlighted]="compileResource.isLoading()" color="accent">Loading</mat-chip>
                    <mat-chip [highlighted]="compileResource.status() === ResourceStatus.Resolved" color="primary">Resolved</mat-chip>
                    <mat-chip [highlighted]="compileResource.status() === ResourceStatus.Error" color="warn">Error</mat-chip>
                </mat-chip-set>
                <p class="mat-caption mt-1">
                    <code>compileResource.status()</code> = {{ compileResource.status() }}
                </p>
            </mat-card-content>
        </mat-card>

        <!-- Error state -->
        @if (compileResource.status() === ResourceStatus.Error) {
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
                    <mat-card-subtitle>
                        Loaded via <code>rxResource()</code> — signal-native, no manual subscribe
                    </mat-card-subtitle>
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

        <!-- Pattern info card -->
        <mat-card appearance="outlined" class="info-card mt-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>school</mat-icon>
                <mat-card-title>Angular 21 Patterns Used Here</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <div class="pattern-list">
                    <div class="pattern-item">
                        <code>rxResource()</code>
                        <span>Signal-native HTTP; replaces Observable + loading/error signals + takeUntilDestroyed()</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="pattern-item">
                        <code>linkedSignal()</code>
                        <span>URL list resets automatically when preset changes, but remains manually editable</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="pattern-item">
                        <code>toSignal()</code>
                        <span>Route query params bridged from Observable to Signal via toSignal()</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="pattern-item">
                        <code>takeUntilDestroyed()</code>
                        <span>Remaining Observable subscriptions auto-unsubscribed on component destroy</span>
                    </div>
                </div>
            </mat-card-content>
        </mat-card>
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .url-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .url-input-row { display: flex; align-items: center; gap: 8px; }
    .url-field { flex: 1; }
    .transformations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 8px; }
    .error-card { border-color: var(--mat-sys-error); }
    .error-content { display: flex; align-items: center; gap: 8px; color: var(--mat-sys-error); }
    .results-card { border-color: var(--mat-sys-primary); }
    .results-json { background: var(--mat-sys-surface-variant); padding: 16px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto; max-height: 400px; overflow-y: auto; margin: 0; }
    .info-card { background-color: var(--mat-sys-surface-variant); }
    .resource-status-card { background-color: var(--mat-sys-surface-variant); }
    .pattern-list { display: flex; flex-direction: column; gap: 8px; }
    .pattern-item { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
    .pattern-item code { font-weight: 700; font-size: 0.95em; }
    .pattern-item span { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
  `],
})
export class CompilerComponent {
    /** Expose ResourceStatus enum to template */
    readonly ResourceStatus = ResourceStatus;

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
     *   The loader ONLY runs when request() returns a non-null/undefined value
     *   (rxResource contract). When pendingRequest is undefined the resource stays
     *   Idle — no HTTP call is made. The request type is therefore non-optional
     *   inside the loader, so no `!request` guard is needed.
     *   The returned Observable is automatically unsubscribed when it completes
     *   or when the request signal changes.
     */
    readonly compileResource = rxResource<CompileResponse, CompileRequest>({
        request: () => this.pendingRequest(),
        loader: ({ request }) =>
            this.compilerService.compile(
                request.configuration.sources.map(s => s.source),
                request.configuration.transformations,
            ),
    });

    readonly availableTransformations: readonly string[];

    compilerForm!: FormGroup;

    private readonly fb              = inject(FormBuilder);
    private readonly compilerService = inject(CompilerService);
    private readonly route           = inject(ActivatedRoute);
    private readonly router          = inject(Router);

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

    constructor() {
        this.availableTransformations = this.compilerService.getAvailableTransformations();
        this.initializeForm();

        // effect() reads queryParams() (a Signal) and syncs the form when ?url= changes.
        // effect() is appropriate here because we are updating a FormArray (external to the
        // signal graph) rather than writing another signal — the recommended usage pattern.
        // Note: effect() must be created in an injection context (constructor or field init).
        effect(() => {
            const urlParam = this.queryParams()?.get('url');
            if (urlParam) {
                this.urlsArray.at(0).setValue(urlParam);
            }
        });
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

        // Set the request signal → rxResource() starts loading automatically.
        this.pendingRequest.set({
            configuration: {
                name: 'Angular PoC Compilation',
                sources: urls.map(source => ({ source })),
                transformations: selectedTransformations,
            },
            benchmark: true,
        });

        if (urls[0]) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { url: urls[0] },
                queryParamsHandling: 'merge',
            });
        }
    }
}

