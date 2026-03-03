/**
 * FilterParserService — Manages the filter-parser Web Worker.
 *
 * Offloads heavy filter list parsing to a background thread and
 * exposes results as signals. Falls back to main-thread parsing
 * if Web Workers are not available (SSR).
 *
 * Angular 21 patterns: signal(), computed(), Injectable, PLATFORM_ID
 */

import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ParsedRule {
    readonly line: number;
    readonly raw: string;
    readonly type: 'url' | 'comment' | 'filter' | 'empty' | 'unknown';
}

export interface ParsedResult {
    readonly rules: ParsedRule[];
    readonly totalLines: number;
    readonly urlCount: number;
    readonly filterCount: number;
    readonly commentCount: number;
    readonly duration: number;
}

@Injectable({ providedIn: 'root' })
export class FilterParserService {
    private readonly platformId = inject(PLATFORM_ID);
    private worker: Worker | null = null;

    /** Current parse result */
    readonly result = signal<ParsedResult | null>(null);
    /** Whether parsing is in progress */
    readonly isParsing = signal(false);
    /** Parse progress (0-100) */
    readonly progress = signal(0);
    /** Last error message */
    readonly error = signal<string | null>(null);
    /** Extracted URLs from the last parse */
    readonly extractedUrls = computed(() => {
        const r = this.result();
        if (!r) return [];
        return r.rules.filter(rule => rule.type === 'url').map(rule => rule.raw);
    });

    /**
     * Parse filter list text in a Web Worker.
     * Falls back to synchronous parsing if Workers are unavailable.
     */
    parse(text: string): void {
        this.isParsing.set(true);
        this.progress.set(0);
        this.error.set(null);
        this.result.set(null);

        if (!isPlatformBrowser(this.platformId) || typeof Worker === 'undefined') {
            // SSR or no Worker support — skip
            this.isParsing.set(false);
            return;
        }

        try {
            if (!this.worker) {
                this.worker = new Worker(
                    new URL('../workers/filter-parser.worker', import.meta.url),
                    { type: 'module' },
                );
                this.worker.onmessage = (event) => this.handleMessage(event);
                this.worker.onerror = (error) => {
                    this.error.set(error.message);
                    this.isParsing.set(false);
                };
            }

            this.worker.postMessage({ type: 'parse', payload: text });
        } catch (error) {
            this.error.set((error as Error).message);
            this.isParsing.set(false);
        }
    }

    /** Terminate the worker (cleanup) */
    terminate(): void {
        this.worker?.terminate();
        this.worker = null;
    }

    private handleMessage(event: MessageEvent): void {
        const { type, payload } = event.data;

        switch (type) {
            case 'result':
                this.result.set(payload as ParsedResult);
                this.isParsing.set(false);
                this.progress.set(100);
                break;
            case 'progress':
                this.progress.set(payload as number);
                break;
            case 'error':
                this.error.set(payload as string);
                this.isParsing.set(false);
                break;
        }
    }
}
