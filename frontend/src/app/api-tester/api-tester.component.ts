/**
 * ApiTesterComponent — Interactive API endpoint tester.
 *
 * Features:
 *   - Endpoint selector (GET /api, GET /metrics, GET /queue/stats, POST /compile)
 *   - Request body editor (shown for POST endpoints)
 *   - Send button with loading state
 *   - Response viewer with HTTP status badge and syntax-highlighted JSON
 *
 * Reused by HomeComponent and ApiDocsComponent.
 *
 * Angular 21 patterns: signal(), inject(), @if/@for control flow
 */

import { Component, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { API_BASE_URL } from '../tokens';
import { LogService } from '../services/log.service';

interface EndpointOption {
    readonly value: string;
    readonly label: string;
    readonly method: 'GET' | 'POST';
}

@Component({
    selector: 'app-api-tester',
    imports: [
        FormsModule,
        MatCardModule,
        MatSelectModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatChipsModule,
    ],
    template: `
        @if (!collapsed()) {
            <mat-card appearance="outlined" class="tester-card">
                <mat-card-header>
                    <mat-icon mat-card-avatar>science</mat-icon>
                    <mat-card-title>Interactive API Tester</mat-card-title>
                    <mat-card-subtitle>Test API endpoints directly from the browser</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                    <div class="tester-controls">
                        <mat-form-field appearance="outline" class="endpoint-field">
                            <mat-label>Endpoint</mat-label>
                            <mat-select [(value)]="selectedEndpoint"
                                (selectionChange)="onEndpointChange()">
                                @for (ep of endpoints; track ep.value) {
                                    <mat-option [value]="ep.value">
                                        {{ ep.method }} {{ ep.label }}
                                    </mat-option>
                                }
                            </mat-select>
                        </mat-form-field>

                        @if (isPostEndpoint()) {
                            <mat-form-field appearance="outline" class="body-field">
                                <mat-label>Request Body (JSON)</mat-label>
                                <textarea matInput [(ngModel)]="requestBody" rows="10"
                                    placeholder="Enter JSON request body"></textarea>
                            </mat-form-field>
                        }

                        <div class="action-row">
                            <button mat-raised-button color="primary"
                                (click)="sendRequest()"
                                [disabled]="isLoading()">
                                @if (isLoading()) {
                                    <mat-progress-spinner diameter="20" mode="indeterminate" />
                                    Sending…
                                } @else {
                                    <span><mat-icon>send</mat-icon> Send Request</span>
                                }
                            </button>
                            <button mat-stroked-button (click)="resetResponse()">
                                <mat-icon>refresh</mat-icon> Reset
                            </button>
                        </div>
                    </div>

                    @if (response()) {
                        <div class="response-section mt-2">
                            <div class="response-header">
                                <span class="mat-body-1" style="font-weight: 600;">Response</span>
                                <span class="status-badge" [class]="statusClass()">
                                    {{ response()!.status }} {{ response()!.statusText }}
                                </span>
                            </div>
                            <pre class="json-viewer" [innerHTML]="formattedResponse()"></pre>
                        </div>
                    }
                </mat-card-content>
                <mat-card-actions>
                    <button mat-button (click)="collapsed.set(true)">
                        <mat-icon>close</mat-icon> Close
                    </button>
                </mat-card-actions>
            </mat-card>
        }
    `,
    styles: [`
        .tester-card { border-color: var(--app-border); }
        .tester-controls { display: flex; flex-direction: column; gap: 12px; }
        .endpoint-field { width: 100%; }
        .body-field { width: 100%; }
        .action-row { display: flex; gap: 12px; align-items: center; }
        .response-section { border-top: 1px solid var(--app-border); padding-top: 16px; }
        .response-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    `],
})
export class ApiTesterComponent {
    /** Whether the tester is collapsed (hidden) */
    readonly collapsed = model(true);

    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly log = inject(LogService);

    readonly endpoints: EndpointOption[] = [
        { value: '/api', label: '/api — API Information', method: 'GET' },
        { value: '/metrics', label: '/metrics — Performance Metrics', method: 'GET' },
        { value: '/queue/stats', label: '/queue/stats — Queue Statistics', method: 'GET' },
        { value: '/compile', label: '/compile — Compile Filter List', method: 'POST' },
    ];

    selectedEndpoint = '/api';
    requestBody = JSON.stringify({
        configuration: {
            name: 'Test Filter List',
            sources: [
                {
                    name: 'Example Source',
                    source: '||example.com^\n||ads.example.com^\n127.0.0.1 tracker.example.com',
                },
            ],
            transformations: ['RemoveComments', 'Deduplicate', 'RemoveEmptyLines'],
        },
        benchmark: true,
    }, null, 2);

    readonly isLoading = signal(false);
    readonly response = signal<{ status: number; statusText: string; data: unknown } | null>(null);

    isPostEndpoint(): boolean {
        return this.endpoints.find(e => e.value === this.selectedEndpoint)?.method === 'POST';
    }

    statusClass(): string {
        const status = this.response()?.status;
        if (!status) return 'info';
        if (status >= 200 && status < 300) return 'success';
        if (status >= 400 && status < 500) return 'warning';
        return 'error';
    }

    formattedResponse(): string {
        const data = this.response()?.data;
        if (!data) return '';
        const jsonString = JSON.stringify(data, null, 2);
        // HTML-escape, then apply syntax highlighting classes
        const escaped = jsonString
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return escaped
            .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
            .replace(/: "([^"]*)"([,\n])/g, ': <span class="json-string">"$1"</span>$2')
            .replace(/: (-?\d+\.?\d*)(,?\n?)/g, ': <span class="json-number">$1</span>$2')
            .replace(/: (true|false)(,?\n?)/g, ': <span class="json-boolean">$1</span>$2')
            .replace(/: (null)(,?\n?)/g, ': <span class="json-null">$1</span>$2');
    }

    onEndpointChange(): void {
        this.response.set(null);
    }

    resetResponse(): void {
        this.response.set(null);
    }

    async sendRequest(): Promise<void> {
        this.isLoading.set(true);
        this.response.set(null);

        const endpoint = this.endpoints.find(e => e.value === this.selectedEndpoint);
        if (!endpoint) return;

        const url = endpoint.value.startsWith('/api')
            ? `${this.apiBaseUrl}${endpoint.value.replace('/api', '')}`
            : endpoint.value;

        this.log.info(`API test: ${endpoint.method} ${endpoint.value}`, 'api-tester');

        try {
            const options: RequestInit = {
                method: endpoint.method,
                headers: { 'Content-Type': 'application/json' },
            };

            if (endpoint.method === 'POST' && this.requestBody) {
                options.body = this.requestBody;
            }

            const res = await fetch(url, options);
            const data = await res.json();

            this.response.set({ status: res.status, statusText: res.statusText, data });
            this.log.info(`API test response: ${res.status}`, 'api-tester', { endpoint: endpoint.value, status: res.status });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.response.set({ status: 0, statusText: 'Network Error', data: { error: message } });
            this.log.error(`API test error: ${message}`, 'api-tester', { endpoint: endpoint.value });
        } finally {
            this.isLoading.set(false);
        }
    }
}
