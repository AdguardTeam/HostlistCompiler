/**
 * LogService — Centralized structured logging with Cloudflare backend reporting.
 *
 * Provides:
 *   - Log levels (debug, info, warn, error) with structured payloads
 *   - Session-scoped trace ID (single UUID per page load) for correlating
 *     frontend logs with Cloudflare Worker request traces
 *   - `reportError()` sends error payloads to the Cloudflare Worker via
 *     `navigator.sendBeacon()` — reliable even during page unload
 *   - Designed primarily for browser environments; in SSR/non-browser contexts it avoids browser-only APIs
 *     but may still log to the console and buffer entries
 *
 * The Cloudflare Worker at LOG_ENDPOINT can ingest these payloads into
 * Workers Analytics Engine, Logpush, or a D1 table for post-mortem analysis.
 */

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LOG_ENDPOINT } from '../tokens';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    readonly level: LogLevel;
    readonly message: string;
    readonly category?: string;
    readonly traceId: string;
    readonly sessionId: string;
    readonly timestamp: string;
    readonly url?: string;
    readonly userAgent?: string;
    readonly data?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class LogService {
    private static fallbackCounter = 0;

    private readonly platformId = inject(PLATFORM_ID);
    private readonly logEndpoint = inject(LOG_ENDPOINT);

    /** Session-scoped trace ID — same for all logs in this page lifecycle */
    readonly sessionId: string;

    /** Buffer of recent log entries (last 50, in-memory only) */
    private readonly buffer: LogEntry[] = [];
    private readonly MAX_BUFFER = 50;

    constructor() {
        this.sessionId = this.generateId();
    }

    /** Generate a unique trace ID for a single operation (e.g. one HTTP request) */
    generateTraceId(): string {
        return this.generateId();
    }

    debug(message: string, category?: string, data?: Record<string, unknown>): void {
        this.log('debug', message, category, data);
    }

    info(message: string, category?: string, data?: Record<string, unknown>): void {
        this.log('info', message, category, data);
    }

    warn(message: string, category?: string, data?: Record<string, unknown>): void {
        this.log('warn', message, category, data);
    }

    error(message: string, category?: string, data?: Record<string, unknown>): void {
        this.log('error', message, category, data);
    }

    /**
     * Report an error to the Cloudflare Worker backend.
     * Uses `navigator.sendBeacon()` for reliable delivery even during
     * page unload or navigation. Falls back to fetch() if sendBeacon
     * is unavailable.
     */
    reportError(error: {
        message: string;
        stack?: string;
        context?: string;
    }): void {
        if (!isPlatformBrowser(this.platformId) || !this.logEndpoint) return;

        const entry: LogEntry = {
            level: 'error',
            message: error.message,
            category: 'unhandled-error',
            traceId: this.generateId(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            url: this.safeUrl(),
            userAgent: this.safeUserAgent(),
            data: {
                stack: error.stack,
                context: error.context,
            },
        };

        this.send(entry);
    }

    /** Get recent log entries (for diagnostic UI or export) */
    getRecentLogs(): readonly LogEntry[] {
        return this.buffer.slice();
    }

    /** Flush all buffered error-level logs to the backend */
    flush(): void {
        const errors = this.buffer.filter(e => e.level === 'error');
        errors.forEach(entry => this.send(entry));
    }

    private log(level: LogLevel, message: string, category?: string, data?: Record<string, unknown>): void {
        const entry: LogEntry = {
            level,
            message,
            category,
            traceId: this.generateId(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            url: this.safeUrl(),
            data,
        };

        // Add to in-memory buffer
        this.buffer.push(entry);
        if (this.buffer.length > this.MAX_BUFFER) {
            this.buffer.shift();
        }

        // Console output (structured)
        const prefix = `[${level.toUpperCase()}]${category ? ` [${category}]` : ''}`;
        switch (level) {
            case 'debug': console.debug(prefix, message, data ?? ''); break;
            case 'info':  console.info(prefix, message, data ?? '');  break;
            case 'warn':  console.warn(prefix, message, data ?? '');  break;
            case 'error': console.error(prefix, message, data ?? ''); break;
        }
    }

    private send(entry: LogEntry): void {
        if (!isPlatformBrowser(this.platformId) || !this.logEndpoint) return;

        const payload = JSON.stringify(entry);

        try {
            // sendBeacon is fire-and-forget — survives page unload
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(this.logEndpoint, blob);
            } else {
                // Fallback to fetch (no await — fire and forget)
                fetch(this.logEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true,
                }).catch(() => { /* swallow — logging should never throw */ });
            }
        } catch {
            // Logging must never throw — silently ignore
        }
    }

    private generateId(): string {
        try {
            return crypto.randomUUID();
        } catch {
            // Fallback for environments without crypto.randomUUID
            try {
                // Use crypto.getRandomValues to generate a UUID-like identifier
                const buf = new Uint8Array(16);
                crypto.getRandomValues(buf);

                // Set version (4) and variant bits according to RFC 4122
                buf[6] = (buf[6] & 0x0f) | 0x40;
                buf[8] = (buf[8] & 0x3f) | 0x80;

                const toHex = (n: number) => n.toString(16).padStart(2, '0');
                const hex = Array.from(buf, toHex).join('');
                return (
                    hex.slice(0, 8) + '-' +
                    hex.slice(8, 12) + '-' +
                    hex.slice(12, 16) + '-' +
                    hex.slice(16, 20) + '-' +
                    hex.slice(20)
                );
            } catch {
                // Last-resort fallback for environments without crypto APIs:
                // rely on time plus a monotonic counter (no Math.random()).
                const counter = LogService.fallbackCounter = (LogService.fallbackCounter + 1) >>> 0;
                return `${Date.now().toString(36)}-${counter.toString(36)}`;
            }
        }
    }

    private safeUrl(): string | undefined {
        try { return isPlatformBrowser(this.platformId) ? location.href : undefined; }
        catch { return undefined; }
    }

    private safeUserAgent(): string | undefined {
        try { return isPlatformBrowser(this.platformId) ? navigator.userAgent : undefined; }
        catch { return undefined; }
    }
}
