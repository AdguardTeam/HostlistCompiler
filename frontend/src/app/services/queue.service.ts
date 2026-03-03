/**
 * QueueService — Fetches queue stats and polls async compilation results.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { startWith, switchMap, takeWhile } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';

export interface QueueStats {
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
    processingRate: number;
    averageProcessingTime: number;
    queueLag: number;
    lastUpdate: string;
}

/**
 * Terminal and non-terminal states for a queued compilation job.
 *
 * - `pending`   — Job is in the queue, not yet started.
 * - `completed` — Job finished successfully; `ruleCount` and `rules` are populated.
 * - `failed`    — Job encountered an error; `error` field contains the reason.
 * - `not_found` — The requestId is unknown to the server (never queued or expired).
 * - `no_cache`  — The result existed but the cache entry has been evicted.
 * - `cache_miss`— Result was expected in cache but was not found (transient, retry once).
 * - `cancelled` — Job was explicitly cancelled before processing.
 */
export type QueueJobStatus = 'completed' | 'pending' | 'failed' | 'not_found' | 'no_cache' | 'cache_miss' | 'cancelled';

export interface QueueJobResult {
    status: QueueJobStatus;
    ruleCount?: number;
    rules?: string[];
    error?: string;
    jobInfo?: {
        configName: string;
        duration: number;
        timestamp: string;
        error?: string;
    };
}

/** Statuses that indicate a job has reached a final state with no further polling needed. */
export const TERMINAL_JOB_STATUSES: QueueJobStatus[] = ['completed', 'failed', 'not_found', 'no_cache', 'cache_miss', 'cancelled'];

@Injectable({
    providedIn: 'root',
})
export class QueueService {
    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);

    getQueueStats(): Observable<QueueStats> {
        return this.http.get<QueueStats>(`${this.apiBaseUrl}/queue/stats`);
    }

    /**
     * Polls /queue/results/:requestId every intervalMs until the job reaches a terminal state.
     * @param requestId - The unique identifier of the async compilation job to poll.
     * @param intervalMs - Polling interval in milliseconds. Defaults to 3000ms.
     */
    pollResults(requestId: string, intervalMs = 3000): Observable<QueueJobResult> {
        return interval(intervalMs).pipe(
            startWith(0),
            switchMap(() =>
                this.http.get<QueueJobResult>(`${this.apiBaseUrl}/queue/results/${requestId}`),
            ),
            // inclusive: true ensures the terminal-status result is emitted before the observable completes
            takeWhile(result => !TERMINAL_JOB_STATUSES.includes(result.status), true),
        );
    }
}
