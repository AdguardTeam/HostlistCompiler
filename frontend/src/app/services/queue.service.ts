/**
 * QueueService — Wraps /queue/* API endpoints for async compilation monitoring.
 *
 * Provides:
 *   - getStats()     → GET /queue/stats
 *   - getResults()   → GET /queue/results/:requestId
 *   - pollResults()  → Observable that polls until job completes/fails
 *
 * Angular 21 Pattern: Injectable service with inject(), Observable + signal interop
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { map, switchMap, takeWhile, tap } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';
import { LogService } from './log.service';

/**
 * All possible statuses returned by the queue results endpoint.
 * - `pending`    / `processing` — job is still running (non-terminal, keep polling)
 * - `completed`  / `failed` / `cancelled` — job is done (terminal, stop polling)
 * - `not_found`  — job not yet written to history (transient; treated as non-terminal
 *                  for up to NOT_FOUND_GRACE_RETRIES polls, then terminal)
 * - `cache_miss` — job result expired from cache (terminal; log and stop polling)
 */
export type QueueJobStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'not_found'
    | 'cache_miss';

/** Statuses that unambiguously end polling immediately (excluding `not_found` which has a grace budget). */
const TERMINAL_JOB_STATUSES: readonly QueueJobStatus[] = ['completed', 'failed', 'cancelled', 'not_found', 'cache_miss'];

/**
 * Number of consecutive `not_found` responses to tolerate before treating the
 * status as terminal.  The backend only writes history entries once a job
 * completes / fails / is cancelled, so the first several polls for a freshly
 * queued job often return `not_found`.
 */
const NOT_FOUND_GRACE_RETRIES = 10;

export interface QueueStats {
    readonly success?: boolean;
    readonly currentDepth: number;
    readonly pending: number;
    readonly completed: number;
    readonly failed: number;
    readonly processingRate: number;
    readonly lag: number;
    readonly depthHistory: DepthHistoryEntry[];
    readonly history?: QueueJobEntry[];
    readonly error?: string;
}

export interface DepthHistoryEntry {
    readonly timestamp: string;
    readonly depth: number;
}

export interface QueueJobEntry {
    readonly requestId: string;
    readonly configName?: string;
    readonly status: QueueJobStatus;
    readonly duration?: number;
    readonly completedAt?: string;
}

export interface QueueResult {
    readonly success: boolean;
    readonly status: QueueJobStatus;
    readonly requestId: string;
    readonly rules?: string[];
    readonly ruleCount?: number;
    readonly error?: string;
    readonly duration?: number;
    readonly metrics?: Record<string, unknown>;
}

@Injectable({
    providedIn: 'root',
})
export class QueueService {
    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly log = inject(LogService);

    /** GET /queue/stats — queue depth, job counts, depth history */
    getStats(): Observable<QueueStats> {
        return this.http.get<QueueStats>(`${this.apiBaseUrl}/../queue/stats`).pipe(
            map(stats => {
                // Normalize: ensure depthHistory is always an array
                return {
                    ...stats,
                    depthHistory: stats.depthHistory ?? [],
                };
            }),
        );
    }

    /** GET /queue/results/:requestId — retrieve results for a queued job */
    getResults(requestId: string): Observable<QueueResult> {
        return this.http.get<QueueResult>(`${this.apiBaseUrl}/../queue/results/${requestId}`);
    }

    /**
     * Poll for queue results until the job completes or fails.
     *
     * Emits every poll response (including intermediate 'pending' statuses),
     * and completes when the job reaches a terminal state.
     *
     * `not_found` responses are tolerated for up to NOT_FOUND_GRACE_RETRIES
     * consecutive polls (the backend only writes history on completion), after
     * which they are treated as terminal and polling stops.
     *
     * @param requestId  - The async job request ID
     * @param intervalMs - Polling interval in milliseconds (default 5000)
     */
    pollResults(requestId: string, intervalMs = 5000): Observable<QueueResult> {
        this.log.info(`Starting poll for job ${requestId}`, 'queue', { requestId, intervalMs });

        // Track consecutive not_found responses outside the pipe to avoid
        // an unsafe initial accumulator cast in scan().
        let notFoundCount = 0;

        return timer(0, intervalMs).pipe(
            switchMap(() => this.getResults(requestId)),
            tap(result => {
                notFoundCount = result.status === 'not_found' ? notFoundCount + 1 : 0;
            }),
            takeWhile(
                result =>
                    !TERMINAL_JOB_STATUSES.includes(result.status) ||
                    (result.status === 'not_found' && notFoundCount <= NOT_FOUND_GRACE_RETRIES),
                true, // include the terminal emission
            ),
            tap(result => {
                if (result.status === 'completed') {
                    this.log.info(`Job ${requestId} completed`, 'queue', {
                        requestId,
                        ruleCount: result.ruleCount,
                        duration: result.duration,
                    });
                } else if (result.status === 'failed') {
                    this.log.error(`Job ${requestId} failed: ${result.error}`, 'queue', {
                        requestId,
                        error: result.error,
                    });
                } else if (result.status === 'not_found') {
                    this.log.debug(`Job ${requestId} not_found (may still be pending)`, 'queue', { requestId });
                }
            }),
        );
    }
}
