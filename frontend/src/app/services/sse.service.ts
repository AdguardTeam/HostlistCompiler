/**
 * SseService — Generic EventSource wrapper returning Angular signals.
 *
 * Wraps the browser's native EventSource API and exposes SSE events as
 * reactive signals. Handles connection lifecycle, typed event parsing,
 * and automatic cleanup on disconnect.
 *
 * Usage:
 *   const connection = sseService.connect('/compile/stream', body);
 *   // Read signals in templates or effects:
 *   connection.events()   // all events
 *   connection.status()   // 'idle' | 'connecting' | 'open' | 'error' | 'closed'
 *   // Clean up:
 *   connection.close();
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { API_BASE_URL } from '../tokens';
import { LogService } from './log.service';

/** Possible SSE connection states */
export type SseStatus = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

/** A parsed SSE event with type and data */
export interface SseEvent<T = unknown> {
    readonly type: string;
    readonly data: T;
    readonly timestamp: Date;
}

/** An active SSE connection with reactive signals */
export interface SseConnection {
    /** All received events (append-only) */
    readonly events: ReturnType<typeof signal<SseEvent[]>>;
    /** Current connection status */
    readonly status: ReturnType<typeof signal<SseStatus>>;
    /** Latest event of a specific type */
    latestByType: (type: string) => SseEvent | undefined;
    /** Whether the connection is active */
    readonly isActive: ReturnType<typeof computed<boolean>>;
    /** Number of retry attempts so far (0 = first try) */
    readonly retryCount: ReturnType<typeof signal<number>>;
    /** Close the connection and clean up */
    close: () => void;
}

/**
 * SseService
 *
 * Since EventSource only supports GET, and the compile API requires POST
 * with a request body, this service uses fetch() with streaming response
 * parsing instead of native EventSource. The SSE protocol is the same —
 * we just read the text/event-stream body manually.
 */
@Injectable({
    providedIn: 'root',
})
export class SseService {
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly logger = inject(LogService);

    /**
     * Opens a streaming POST connection to the given endpoint.
     * Parses the SSE text/event-stream response and populates signals.
     *
     * @param path   - Relative API path (e.g. '/compile/stream')
     * @param body   - Request body to POST as JSON
     * @returns SseConnection with reactive signals
     */
    private static readonly MAX_RETRIES = 3;

    connect<T = unknown>(path: string, body: unknown): SseConnection {
        const events = signal<SseEvent<T>[]>([]);
        const status = signal<SseStatus>('idle');
        const retryCount = signal(0);
        let abortController: AbortController | null = new AbortController();
        let connectionId = 0;

        const isActive = computed(() => {
            const s = status();
            return s === 'connecting' || s === 'open';
        });

        const latestByType = (type: string): SseEvent<T> | undefined => {
            const all = events();
            for (let i = all.length - 1; i >= 0; i--) {
                if (all[i].type === type) return all[i] as SseEvent<T>;
            }
            return undefined;
        };

        const close = () => {
            connectionId++; // Invalidate any pending retries
            abortController?.abort();
            abortController = null;
            status.set('closed');
        };

        const url = `${this.apiBaseUrl}${path}`;

        const attempt = (retry: number) => {
            if (!abortController) return; // connection was closed
            const thisConnectionId = connectionId;
            retryCount.set(retry);
            status.set('connecting');

            this.streamFetch<T>(
                url,
                body,
                abortController.signal,
                (event) => {
                    events.update(prev => [...prev, event]);
                },
                () => status.set('open'),
                () => status.set('closed'),
                (error) => {
                    // Bail out if the connection was closed/replaced during the attempt
                    if (thisConnectionId !== connectionId) return;

                    this.logger.error('[SseService] Stream error', 'sse', {
                        error: error instanceof Error ? error.message : String(error),
                    });

                    if (retry < SseService.MAX_RETRIES && abortController) {
                        const delay = Math.min(1000 * Math.pow(2, retry), 8000);
                        status.set('connecting');
                        setTimeout(() => {
                            if (thisConnectionId === connectionId) {
                                attempt(retry + 1);
                            }
                        }, delay);
                    } else {
                        status.set('error');
                    }
                },
            );
        };

        attempt(0);

        return { events, status, latestByType, isActive, retryCount, close };
    }

    /**
     * Performs a POST fetch and parses the SSE text/event-stream response.
     */
    private async streamFetch<T>(
        url: string,
        body: unknown,
        signal: AbortSignal,
        onEvent: (event: SseEvent<T>) => void,
        onOpen: () => void,
        onComplete: () => void,
        onError: (error: unknown) => void,
    ): Promise<void> {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal,
            });

            if (!response.ok) {
                onError(new Error(`HTTP ${response.status}: ${response.statusText}`));
                return;
            }

            if (!response.body) {
                onError(new Error('Response body is null'));
                return;
            }

            onOpen();

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    const event = this.parseSseBlock<T>(part);
                    if (event) {
                        if (event.type === 'done') {
                            onComplete();
                            return;
                        }
                        onEvent(event);
                    }
                }
            }

            onComplete();
        } catch (error) {
            if (signal.aborted) return; // Expected abort, not an error
            onError(error);
        }
    }

    /**
     * Parses a single SSE block (between double newlines) into an SseEvent.
     * Handles both 'event: type\ndata: json' and 'data: json' formats.
     */
    private parseSseBlock<T>(block: string): SseEvent<T> | null {
        let eventType = 'message';
        const dataLines: string[] = [];

        for (const line of block.split('\n')) {
            if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
            }
        }

        if (dataLines.length === 0) return null;

        const raw = dataLines.join('\n');
        let data: T;
        try {
            data = JSON.parse(raw) as T;
        } catch {
            data = raw as unknown as T;
        }

        return {
            type: eventType,
            data,
            timestamp: new Date(),
        };
    }
}
