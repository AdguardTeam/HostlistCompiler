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

import { Component, computed, DestroyRef, effect, inject, linkedSignal, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed, toSignal, rxResource } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CompileRequest, CompileResponse, CompilerService, BatchCompileItem } from '../services/compiler.service';
import { QueueService, QueueStats, QueueJobResult, TERMINAL_JOB_STATUSES } from '../services/queue.service';
import { NotificationService } from '../services/notification.service';
import { EMPTY, Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { JsonPipe, DecimalPipe, DatePipe } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SseService, SseConnection } from '../services/sse.service';
import { TurnstileComponent } from '../turnstile/turnstile.component';
import { TurnstileService } from '../services/turnstile.service';
import { FilterParserService } from '../services/filter-parser.service';
import { TURNSTILE_SITE_KEY } from '../tokens';

export type CompilationMode = 'json' | 'stream' | 'async' | 'batch';

/** Named preset configurations */
interface Preset {
    readonly label: string;
    readonly urls: string[];
    readonly transformations: string[];
}

/** One item in the batch configuration list */
interface BatchItem {
    id: string;
    name: string;
    urls: string[];
    transformations: string[];
}

/**
 * CompilerComponent
 * Demonstrates resource(), rxResource(), linkedSignal(), and toSignal().
 */
@Component({
    selector: 'app-compiler',
    imports: [
        ReactiveFormsModule,
        JsonPipe,
        DecimalPipe,
        DatePipe,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        MatCheckboxModule,
        MatCardModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatDividerModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatExpansionModule,
        ScrollingModule,
        TurnstileComponent,
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

        <!-- Compilation mode toggle -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-card-title>Compilation Mode</mat-card-title>
                <mat-card-subtitle>Select how the compilation request is submitted</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <mat-button-toggle-group
                    [value]="compilationMode()"
                    (change)="compilationMode.set($event.value)"
                    aria-label="Compilation mode"
                >
                    <mat-button-toggle value="json">
                        <mat-icon>data_object</mat-icon> JSON
                    </mat-button-toggle>
                    <mat-button-toggle value="stream">
                        <mat-icon>stream</mat-icon> Stream
                    </mat-button-toggle>
                    <mat-button-toggle value="async">
                        <mat-icon>schedule</mat-icon> Async
                    </mat-button-toggle>
                    <mat-button-toggle value="batch">
                        <mat-icon>layers</mat-icon> Batch
                    </mat-button-toggle>
                </mat-button-toggle-group>
                <p class="mode-description mat-body-2 mt-1">
                    @switch (compilationMode()) {
                        @case ('json') { Synchronous JSON response via <code>rxResource()</code> }
                        @case ('stream') { Real-time SSE streaming via <code>SseService</code> }
                        @case ('async') { Queue-based async compilation — returns a <code>requestId</code> for polling }
                        @case ('batch') { Submit multiple configurations in a single request }
                    }
                </p>
            </mat-card-content>
        </mat-card>

        <!-- Reactive Form — shown for json, stream, async modes -->
        @if (compilationMode() !== 'batch') {
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
                <app-turnstile [siteKey]="turnstileSiteKey" />

                <!-- Submit -->
                <div class="submit-row">
                    <button
                        mat-raised-button color="primary" type="submit"
                        [disabled]="isCompiling() || compilerForm.invalid"
                    >
                        @if (isCompiling()) {
                            <mat-progress-spinner diameter="20" mode="indeterminate" color="accent" />
                            Compiling...
                        } @else {
                            <span><mat-icon>play_arrow</mat-icon>
                                @switch (compilationMode()) {
                                    @case ('stream') { Stream }
                                    @case ('async') { Queue Async }
                                    @default { Compile }
                                }
                            </span>
                        }
                    </button>
                </div>
            </form>
        }

        <!-- Batch mode form -->
        @if (compilationMode() === 'batch') {
            <mat-card appearance="outlined" class="mb-2">
                <mat-card-header>
                    <mat-card-title>Batch Configurations</mat-card-title>
                    <mat-card-subtitle>Add multiple configurations to compile in one request</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    @for (item of batchItems(); track item.id; let i = $index) {
                        <mat-card appearance="outlined" class="batch-item mb-2">
                            <mat-card-header>
                                <mat-card-title>{{ item.name }}</mat-card-title>
                                <mat-card-actions>
                                    @if (batchItems().length > 1) {
                                        <button mat-icon-button color="warn" (click)="removeBatchItem(i)" aria-label="Remove configuration">
                                            <mat-icon>delete</mat-icon>
                                        </button>
                                    }
                                </mat-card-actions>
                            </mat-card-header>
                            <mat-card-content>
                                <mat-form-field appearance="outline" class="full-width mb-1">
                                    <mat-label>Configuration Name</mat-label>
                                    <input matInput [value]="item.name" (input)="updateBatchItemName(i, $any($event.target).value)" />
                                </mat-form-field>
                                @for (url of item.urls; track $index; let j = $index) {
                                    <div class="url-input-row mb-1">
                                        <mat-form-field appearance="outline" class="url-field">
                                            <mat-label>URL {{ j + 1 }}</mat-label>
                                            <input matInput type="url" [value]="url"
                                                placeholder="https://example.com/filters.txt"
                                                (input)="updateBatchItemUrl(i, j, $any($event.target).value)" />
                                        </mat-form-field>
                                        @if (item.urls.length > 1) {
                                            <button mat-icon-button color="warn" (click)="removeBatchItemUrl(i, j)" aria-label="Remove URL">
                                                <mat-icon>remove_circle</mat-icon>
                                            </button>
                                        }
                                    </div>
                                }
                                <button mat-stroked-button type="button" (click)="addBatchItemUrl(i)" class="mb-1">
                                    <mat-icon>add</mat-icon> Add URL
                                </button>
                                <div class="transformations-grid mt-1">
                                    @for (trans of availableTransformations; track trans) {
                                        <mat-checkbox
                                            [checked]="item.transformations.includes(trans)"
                                            (change)="toggleBatchItemTransformation(i, trans, $event.checked)">
                                            {{ trans }}
                                        </mat-checkbox>
                                    }
                                </div>
                            </mat-card-content>
                        </mat-card>
                    }
                    <button mat-stroked-button (click)="addBatchItem()">
                        <mat-icon>add</mat-icon> Add Configuration
                    </button>
                </mat-card-content>
                <mat-card-actions>
                    <button mat-raised-button color="primary"
                        [disabled]="isCompiling() || !batchItems().length"
                        (click)="onSubmit()">
                        @if (isCompiling()) {
                            <mat-progress-spinner diameter="20" mode="indeterminate" color="accent" />
                            Compiling...
                        } @else {
                            <mat-icon>layers</mat-icon> Compile Batch ({{ batchItems().length }})
                        }
                    </button>
                </mat-card-actions>
            </mat-card>
        }

        <!-- resource() status display -->
        <mat-card appearance="outlined" class="resource-status-card mt-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>info</mat-icon>
                <mat-card-title>resource() Status</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <mat-chip-set>
                    <mat-chip [highlighted]="compileResource.status() === 'idle'">Idle</mat-chip>
                    <mat-chip [highlighted]="compileResource.isLoading()" color="accent">Loading</mat-chip>
                    <mat-chip [highlighted]="compileResource.status() === 'resolved'" color="primary">Resolved</mat-chip>
                    <mat-chip [highlighted]="compileResource.status() === 'error'" color="warn">Error</mat-chip>
                </mat-chip-set>
                <p class="mat-caption mt-1">
                    <code>compileResource.status()</code> = {{ compileResource.status() }}
                </p>
            </mat-card-content>
        </mat-card>

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

        <!-- Results (JSON mode) -->
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

        <!-- Async: queued card -->
        @if (asyncJobId(); as jobId) {
            <mat-card appearance="outlined" class="async-card mt-2"
                [class.async-polling]="asyncPolling()"
                [class.async-done]="asyncJobResult()?.status === 'completed'"
                [class.async-error]="asyncJobResult()?.status === 'failed'">
                <mat-card-header>
                    <mat-icon mat-card-avatar>
                        {{ asyncJobResult() ? (asyncJobResult()!.status === 'completed' ? 'check_circle' : 'error') : 'schedule' }}
                    </mat-icon>
                    <mat-card-title>Async Job Queued</mat-card-title>
                    <mat-card-subtitle>
                        Request ID: <code>{{ jobId }}</code>
                    </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    @if (asyncPolling() && !asyncJobResult()) {
                        <div class="polling-indicator">
                            <mat-progress-spinner diameter="24" mode="indeterminate" />
                            <span class="mat-body-2">Polling for results...</span>
                        </div>
                    }
                    @if (asyncJobResult(); as result) {
                        @if (result.status === 'completed') {
                            <mat-chip-set class="mb-2">
                                <mat-chip highlighted color="primary">{{ result.ruleCount | number }} rules</mat-chip>
                                <mat-chip color="primary">completed</mat-chip>
                            </mat-chip-set>
                        } @else {
                            <div class="error-content">
                                <mat-icon color="warn">error</mat-icon>
                                <span>{{ result.error ?? result.status }}</span>
                            </div>
                        }
                    }
                </mat-card-content>
            </mat-card>
        }

        <!-- Async: notification job history -->
        @if (notificationService.jobs().length) {
            <mat-card appearance="outlined" class="mt-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar>notifications</mat-icon>
                    <mat-card-title>Async Job History</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                    @for (job of notificationService.jobs(); track job.requestId) {
                        <div class="job-history-row">
                            <mat-chip
                                [color]="job.status === 'completed' ? 'primary' : job.status === 'failed' ? 'warn' : ''">
                                {{ job.status }}
                            </mat-chip>
                            <span class="mat-body-2">{{ job.configName }}</span>
                            <code class="job-id">{{ job.requestId }}</code>
                            @if (job.ruleCount != null) {
                                <span class="mat-caption">{{ job.ruleCount | number }} rules</span>
                            }
                        </div>
                    }
                </mat-card-content>
            </mat-card>
        }

        <!-- Batch results -->
        @if (batchResult(); as br) {
            <mat-card appearance="outlined" class="results-card mt-2">
                <mat-card-header>
                    <mat-icon mat-card-avatar color="primary">layers</mat-icon>
                    <mat-card-title>Batch Results</mat-card-title>
                    <mat-card-subtitle>{{ br.results.length }} configurations compiled</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    @for (r of br.results; track r.id) {
                        <div class="batch-result-row">
                            <mat-chip [color]="r.success ? 'primary' : 'warn'" highlighted>
                                {{ r.success ? 'OK' : 'FAIL' }}
                            </mat-chip>
                            <span class="mat-body-2">{{ r.id }}</span>
                            @if (r.success) {
                                <span class="mat-caption">{{ r.ruleCount | number }} rules</span>
                            } @else {
                                <span class="mat-caption" style="color: var(--mat-sys-error)">{{ r.error }}</span>
                            }
                        </div>
                    }
                </mat-card-content>
            </mat-card>
        }

        <!-- Queue stats panel -->
        <mat-expansion-panel class="mt-2" (opened)="loadQueueStats()">
            <mat-expansion-panel-header>
                <mat-panel-title>
                    <mat-icon class="mr-1">queue</mat-icon> Queue Stats
                </mat-panel-title>
                <mat-panel-description>
                    @if (queueStats()) {
                        {{ queueStats()!.pending }} pending · {{ queueStats()!.completed }} completed · {{ queueStats()!.failed }} failed
                    } @else {
                        Expand to load
                    }
                </mat-panel-description>
            </mat-expansion-panel-header>
            @if (queueStats(); as qs) {
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="mat-caption">Pending</span>
                        <span class="stat-value">{{ qs.pending | number }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="mat-caption">Completed</span>
                        <span class="stat-value">{{ qs.completed | number }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="mat-caption">Failed</span>
                        <span class="stat-value">{{ qs.failed | number }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="mat-caption">Processing Rate</span>
                        <span class="stat-value">{{ qs.processingRate | number }}/min</span>
                    </div>
                    <div class="stat-item">
                        <span class="mat-caption">Avg Processing Time</span>
                        <span class="stat-value">{{ qs.averageProcessingTime | number }}ms</span>
                    </div>
                    <div class="stat-item">
                        <span class="mat-caption">Queue Lag</span>
                        <span class="stat-value">{{ qs.queueLag | number }}ms</span>
                    </div>
                </div>
                <div class="mt-1">
                    <button mat-stroked-button (click)="loadQueueStats()">
                        <mat-icon>refresh</mat-icon> Refresh
                    </button>
                    <span class="mat-caption ml-1">Last updated: {{ qs.lastUpdate | date:'medium' }}</span>
                </div>
            } @else {
                <div class="polling-indicator">
                    <mat-progress-spinner diameter="24" mode="indeterminate" />
                    <span class="mat-body-2">Loading queue stats...</span>
                </div>
            }
        </mat-expansion-panel>

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
    .full-width { width: 100%; }
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
    .drop-zone { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; margin-top: 16px; border: 2px dashed var(--mat-sys-outline-variant); border-radius: 12px; text-align: center; transition: border-color 0.2s, background-color 0.2s; }
    .drop-zone.drag-over { border-color: var(--mat-sys-primary); background-color: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent); }
    .submit-row { display: flex; align-items: center; gap: 16px; }
    .stream-card { border-color: var(--mat-sys-outline); }
    .stream-card.stream-active { border-color: var(--mat-sys-primary); }
    .stream-card.stream-error { border-color: var(--mat-sys-error); }
    .stream-log { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .stream-event { display: flex; align-items: flex-start; gap: 8px; }
    .event-data { background: var(--mat-sys-surface-variant); padding: 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; overflow-x: auto; margin: 0; flex: 1; }
    .mode-description { color: var(--mat-sys-on-surface-variant); margin-top: 8px; }
    .async-card { border-color: var(--mat-sys-outline); }
    .async-card.async-polling { border-color: var(--mat-sys-tertiary, var(--mat-sys-primary)); }
    .async-card.async-done { border-color: var(--mat-sys-primary); }
    .async-card.async-error { border-color: var(--mat-sys-error); }
    .polling-indicator { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
    .stat-item { display: flex; flex-direction: column; gap: 4px; }
    .stat-value { font-size: 1.4rem; font-weight: 600; }
    .batch-item { background-color: var(--mat-sys-surface-container-low, var(--mat-sys-surface-variant)); }
    .batch-result-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .job-history-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .job-id { font-size: 11px; color: var(--mat-sys-on-surface-variant); }
    .mt-1 { margin-top: 8px; }
    .mt-2 { margin-top: 16px; }
    .mb-1 { margin-bottom: 8px; }
    .mb-2 { margin-bottom: 16px; }
    .mr-1 { margin-right: 8px; }
    .ml-1 { margin-left: 8px; }
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
     */
    readonly presetUrls = linkedSignal(() => {
        const preset = this.presets.find(p => p.label === this.selectedPreset());
        return preset?.urls ?? [''];
    });

    /**
     * compilationMode — drives which submission path is used.
     */
    readonly compilationMode = signal<CompilationMode>('json');

    /**
     * pendingRequest signal — set when the user submits the form.
     * When undefined, rxResource() stays Idle (no HTTP call made).
     * When set to a request object, rxResource() starts loading.
     */
    private readonly pendingRequest = signal<CompileRequest | undefined>(undefined);

    /**
     * rxResource() — from @angular/core/rxjs-interop, stable v19+
     */
    readonly compileResource = rxResource<CompileResponse, CompileRequest | undefined>({
        params: (): CompileRequest | undefined => this.pendingRequest(),
        stream: ({ params }) => params ? this.compilerService.compile(
            params.configuration.sources.map((s) => s.source),
            params.configuration.transformations,
        ) : EMPTY,
    });

    readonly availableTransformations: readonly string[];

    compilerForm!: FormGroup;

    private readonly fb              = inject(FormBuilder);
    private readonly compilerService = inject(CompilerService);
    private readonly queueService    = inject(QueueService);
    /** Intentionally public: accessed directly in the template for job history display. */
    readonly notificationService     = inject(NotificationService);
    private readonly sseService      = inject(SseService);
    private readonly liveAnnouncer   = inject(LiveAnnouncer);
    private readonly route           = inject(ActivatedRoute);
    private readonly router          = inject(Router);
    private readonly destroyRef      = inject(DestroyRef);
    private readonly turnstileService = inject(TurnstileService);
    readonly filterParser            = inject(FilterParserService);

    /** Item 1: Turnstile site key — injected via TURNSTILE_SITE_KEY token */
    readonly turnstileSiteKey = inject(TURNSTILE_SITE_KEY);
    /** Active SSE connection (null when not streaming) */
    readonly sseConnection = signal<SseConnection | null>(null);
    /** Drag-over state for the drop zone */
    readonly dragOver = signal(false);
    /** File upload validation error */
    readonly fileError = signal<string | null>(null);

    /** Async job tracking */
    readonly asyncJobId = signal<string | null>(null);
    readonly asyncJobResult = signal<QueueJobResult | null>(null);
    readonly asyncPolling = signal(false);
    private asyncPollSubscription: Subscription | null = null;

    /** Batch compilation result */
    readonly batchResult = signal<{ results: Array<{ id: string; success: boolean; ruleCount?: number; error?: string }> } | null>(null);

    /** Batch items for batch mode */
    readonly batchItems = signal<BatchItem[]>([
        { id: this.generateBatchItemId(), name: 'Batch Item 1', urls: [''], transformations: ['RemoveComments', 'Deduplicate'] },
    ]);

    /** Queue stats */
    readonly queueStats = signal<QueueStats | null>(null);

    /** Combined loading state for all modes */
    readonly isCompiling = computed(() =>
        this.compileResource.isLoading() ||
        (this.sseConnection()?.isActive() ?? false) ||
        this.asyncPolling(),
    );

    /**
     * toSignal() — from @angular/core/rxjs-interop
     */
    private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap, { initialValue: null });

    /**
     * Item 8: Signal-based form wrappers.
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

        // Clean up SSE connection and polling when component is destroyed
        this.destroyRef.onDestroy(() => {
            this.sseConnection()?.close();
            this.asyncPollSubscription?.unsubscribe();
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
        const mode = this.compilationMode();

        if (mode === 'batch') {
            this.submitBatch();
            return;
        }

        if (this.compilerForm.invalid) return;

        const urls: string[] = this.compilerForm.value.urls.filter((u: string) => u.trim());
        const transformationsObj: Record<string, boolean> = this.compilerForm.value.transformations;
        const selectedTransformations = Object.keys(transformationsObj).filter(k => transformationsObj[k]);

        if (!urls.length) return;

        const request: CompileRequest = {
            configuration: {
                name: 'Angular PoC Compilation',
                sources: urls.map(source => ({ source })),
                transformations: selectedTransformations,
            },
            benchmark: true,
        };

        this.liveAnnouncer.announce('Compilation started', 'polite');

        if (mode === 'stream') {
            // SSE streaming mode — close previous connection and open new one
            this.sseConnection()?.close();
            this.sseConnection.set(this.sseService.connect('/compile/stream', request));
        } else if (mode === 'async') {
            this.submitAsync(urls, selectedTransformations, request);
        } else {
            // JSON mode — trigger rxResource
            this.pendingRequest.set(request);
        }

        if (urls[0]) {
            this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { url: urls[0] },
                queryParamsHandling: 'merge',
            });
        }
    }

    /**
     * Submits an async (queue-based) compilation request.
     * On success, records the job in NotificationService and begins polling for results.
     * Sets `asyncPolling` to true until a terminal status is received.
     */
    private submitAsync(urls: string[], transformations: string[], request: CompileRequest): void {
        // Reset previous async state
        this.asyncJobId.set(null);
        this.asyncJobResult.set(null);
        this.asyncPollSubscription?.unsubscribe();
        this.asyncPolling.set(true);

        this.compilerService.compileAsync(urls, transformations)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    const { requestId } = response;
                    this.asyncJobId.set(requestId);
                    this.notificationService.addJob(requestId, request.configuration.name);
                    this.startPolling(requestId, request.configuration.name);
                },
                error: (err) => {
                    this.asyncPolling.set(false);
                    this.liveAnnouncer.announce('Failed to queue async compilation', 'assertive');
                    console.error('[CompilerComponent] compileAsync error:', err);
                },
            });
    }

    /**
     * Polls the queue for results of the given requestId using QueueService.pollResults().
     * Updates `asyncJobResult` on each poll and finalises the job in NotificationService
     * when a terminal status (completed, failed, etc.) is received.
     * @param requestId - The ID returned by the async compile endpoint.
     * @param configName - Display name for the job record.
     */
    private startPolling(requestId: string, configName: string): void {
        this.asyncPollSubscription?.unsubscribe();
        this.asyncPollSubscription = this.queueService.pollResults(requestId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result) => {
                    this.asyncJobResult.set(result);
                    if (TERMINAL_JOB_STATUSES.includes(result.status)) {
                        this.asyncPolling.set(false);
                        if (result.status === 'completed') {
                            this.notificationService.updateJob(requestId, 'completed', { ruleCount: result.ruleCount });
                            this.liveAnnouncer.announce(`Async compilation complete. ${result.ruleCount ?? 0} rules compiled.`, 'polite');
                        } else {
                            this.notificationService.updateJob(requestId, 'failed', { error: result.error ?? result.status });
                            this.liveAnnouncer.announce('Async compilation failed.', 'assertive');
                        }
                    }
                },
                error: (err) => {
                    this.asyncPolling.set(false);
                    this.notificationService.updateJob(requestId, 'failed', { error: String(err) });
                    console.error('[CompilerComponent] pollResults error:', err);
                },
            });
    }

    /**
     * Submits all batch items as a single batch compilation request.
     * Resets `batchResult` before the call and populates it on success.
     */
    private submitBatch(): void {
        const items = this.batchItems();
        if (!items.length) return;

        this.batchResult.set(null);

        const batchItems: BatchCompileItem[] = items.map(item => ({
            id: item.id,
            configuration: {
                name: item.name,
                sources: item.urls.filter(u => u.trim()).map(source => ({ source })),
                transformations: item.transformations,
            },
            benchmark: true,
        }));

        this.compilerService.compileBatch(batchItems)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.batchResult.set(response);
                    this.liveAnnouncer.announce(`Batch complete: ${response.results.length} configurations compiled.`, 'polite');
                },
                error: (err) => {
                    console.error('[CompilerComponent] compileBatch error:', err);
                    this.liveAnnouncer.announce('Batch compilation failed.', 'assertive');
                },
            });
    }

    // Batch item management

    addBatchItem(): void {
        this.batchItems.update(items => [
            ...items,
            { id: this.generateBatchItemId(), name: `Batch Item ${items.length + 1}`, urls: [''], transformations: [] },
        ]);
    }

    removeBatchItem(index: number): void {
        this.batchItems.update(items => items.filter((_, i) => i !== index));
    }

    updateBatchItemName(index: number, name: string): void {
        this.batchItems.update(items => items.map((item, i) => i === index ? { ...item, name } : item));
    }

    addBatchItemUrl(index: number): void {
        this.batchItems.update(items => items.map((item, i) => i === index ? { ...item, urls: [...item.urls, ''] } : item));
    }

    removeBatchItemUrl(index: number, urlIndex: number): void {
        this.batchItems.update(items => items.map((item, i) =>
            i === index ? { ...item, urls: item.urls.filter((_, j) => j !== urlIndex) } : item,
        ));
    }

    updateBatchItemUrl(index: number, urlIndex: number, url: string): void {
        this.batchItems.update(items => items.map((item, i) =>
            i === index ? { ...item, urls: item.urls.map((u, j) => j === urlIndex ? url : u) } : item,
        ));
    }

    toggleBatchItemTransformation(index: number, trans: string, checked: boolean): void {
        this.batchItems.update(items => items.map((item, i) => {
            if (i !== index) return item;
            const transformations = checked
                ? this.addUniqueTransformation(item.transformations, trans)
                : item.transformations.filter(t => t !== trans);
            return { ...item, transformations };
        }));
    }

    /** Returns a new array with `trans` appended only if not already present. */
    private addUniqueTransformation(transformations: string[], trans: string): string[] {
        return transformations.includes(trans) ? transformations : [...transformations, trans];
    }

    loadQueueStats(): void {
        this.queueStats.set(null);
        this.queueService.getQueueStats()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: stats => this.queueStats.set(stats),
                error: err => console.error('[CompilerComponent] getQueueStats error:', err),
            });
    }

    private generateBatchItemId(): string {
        // crypto.randomUUID() is available in Chrome 92+, Firefox 95+, Safari 15.4+.
        // Fall back to a Math.random-based id for environments where it is unavailable.
        return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
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
