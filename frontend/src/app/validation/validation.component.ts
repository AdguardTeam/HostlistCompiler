/**
 * ValidationComponent — validates adblock filter rules via /api/validate.
 *
 * Angular 21 patterns: rxResource for async validation, signal-based form state.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { ValidationService, ValidationResult } from '../services/validation.service';

@Component({
    selector: 'app-validation',
    imports: [
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
        MatDividerModule,
    ],
    template: `
    <div class="page-content">
        <h1 class="mat-headline-4">Filter Rule Validation</h1>
        <p class="subtitle mat-body-1">
            Validate adblock filter rules using the AGTree parser
        </p>

        <!-- Input -->
        <mat-card appearance="outlined" class="mb-2">
            <mat-card-header>
                <mat-icon mat-card-avatar>edit_note</mat-icon>
                <mat-card-title>Rules Input</mat-card-title>
                <mat-card-subtitle>Enter filter rules (one per line)</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <mat-form-field appearance="outline" class="rules-field">
                    <mat-label>Filter rules</mat-label>
                    <textarea matInput
                        [ngModel]="rulesText()"
                        (ngModelChange)="rulesText.set($event)"
                        rows="10"
                        placeholder="||example.com^&#10;@@||trusted.com^&#10;/ads/*"
                    ></textarea>
                    <mat-hint>{{ ruleCount() }} rule(s) entered</mat-hint>
                </mat-form-field>

                <div class="flex items-center gap-4 mt-2">
                    <mat-checkbox [(ngModel)]="strictMode">Strict mode</mat-checkbox>
                    <button mat-raised-button color="primary"
                        [disabled]="validationResource.isLoading() || ruleCount() === 0"
                        (click)="validate()">
                        @if (validationResource.isLoading()) {
                            <mat-progress-spinner diameter="20" mode="indeterminate" />
                            Validating…
                        } @else {
                            <span><mat-icon>check_circle</mat-icon> Validate</span>
                        }
                    </button>
                </div>
            </mat-card-content>
        </mat-card>

        <!-- Results -->
        @if (validationResource.value(); as result) {
            <mat-card appearance="outlined" class="results-card mt-2"
                [class.valid]="result.valid" [class.invalid]="!result.valid">
                <mat-card-header>
                    <mat-icon mat-card-avatar
                        [style.color]="result.valid ? 'var(--mat-sys-primary)' : 'var(--mat-sys-error)'">
                        {{ result.valid ? 'verified' : 'error' }}
                    </mat-icon>
                    <mat-card-title>
                        {{ result.valid ? 'All Rules Valid' : 'Validation Issues Found' }}
                    </mat-card-title>
                    <mat-card-subtitle>
                        {{ result.validRules }}/{{ result.totalRules }} valid
                        @if (result.duration) { — {{ result.duration }} }
                    </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <mat-chip-set class="mb-2">
                        <mat-chip highlighted color="primary">{{ result.validRules }} valid</mat-chip>
                        @if (result.errors.length) {
                            <mat-chip highlighted color="warn">{{ result.errors.length }} errors</mat-chip>
                        }
                        @if (result.warnings.length) {
                            <mat-chip highlighted color="accent">{{ result.warnings.length }} warnings</mat-chip>
                        }
                    </mat-chip-set>

                    @if (result.errors.length || result.warnings.length) {
                        <mat-divider class="mb-2"></mat-divider>
                        <div class="flex flex-col gap-3">
                            @for (err of result.errors; track $index) {
                                <div class="flex gap-3 p-3 rounded-lg bg-[var(--mat-sys-surface-variant)]">
                                    <mat-icon class="error-icon" style="color: var(--mat-sys-error)">error</mat-icon>
                                    <div class="flex flex-col gap-1 flex-1">
                                        <code class="font-mono text-[13px] break-all">{{ err.rule }}</code>
                                        <span class="text-sm text-[var(--mat-sys-on-surface-variant)]">{{ err.message }}</span>
                                        <mat-chip-set>
                                            <mat-chip>Line {{ err.line }}</mat-chip>
                                            <mat-chip>{{ err.errorType }}</mat-chip>
                                        </mat-chip-set>
                                    </div>
                                </div>
                            }
                            @for (warn of result.warnings; track $index) {
                                <div class="flex gap-3 p-3 rounded-lg bg-[var(--mat-sys-surface-variant)]">
                                    <mat-icon class="error-icon" style="color: var(--mat-sys-tertiary)">warning</mat-icon>
                                    <div class="flex flex-col gap-1 flex-1">
                                        <code class="font-mono text-[13px] break-all">{{ warn.rule }}</code>
                                        <span class="text-sm text-[var(--mat-sys-on-surface-variant)]">{{ warn.message }}</span>
                                        <mat-chip-set>
                                            <mat-chip>Line {{ warn.line }}</mat-chip>
                                            <mat-chip>{{ warn.errorType }}</mat-chip>
                                        </mat-chip-set>
                                    </div>
                                </div>
                            }
                        </div>
                    }
                </mat-card-content>
            </mat-card>
        }
    </div>
    `,
    styles: [`
    .page-content { padding: 0; }
    .subtitle { color: var(--mat-sys-on-surface-variant); margin-bottom: 24px; }
    .rules-field { width: 100%; }
    .results-card.valid { border-color: var(--mat-sys-primary); }
    .results-card.invalid { border-color: var(--mat-sys-error); }
    .error-icon { flex-shrink: 0; margin-top: 2px; }
  `],
})
export class ValidationComponent {
    private readonly validationService = inject(ValidationService);

    readonly rulesText = signal('');
    strictMode = false;

    private readonly pendingRules = signal<string[] | undefined>(undefined);

    /** Computed rule count derived from rulesText signal — no manual bookkeeping */
    readonly ruleCount = computed(() => {
        const text = this.rulesText();
        if (!text.trim()) return 0;
        return text.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('!')).length;
    });

    readonly validationResource = rxResource<ValidationResult, string[] | undefined>({
        params: () => this.pendingRules(),
        stream: ({ params }) => params ? this.validationService.validate(params, this.strictMode) : EMPTY,
    });

    validate(): void {
        const rules = this.rulesText()
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('!'));
        if (rules.length) {
            this.pendingRules.set(rules);
        }
    }
}
