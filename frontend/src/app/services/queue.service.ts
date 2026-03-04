/**
 * QueueService — Fetches queue stats and polls async compilation results.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { startWith, switchMap, takeWhile, scan, tap } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';
import { LogService } from './log.service';

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
export const TERMINAL_JOB_STATUSES: QueueJobStatus[] = ['completed', 'failed', 'no_cache', 'cache_miss', 'cancelled'];

/**
 * Maximum number of consecutive `not_found` responses before treating the job as truly missing.
 * The backend only writes a result to history on completion/failed/cancelled, so a newly queued
 * job will return `not_found` for several polls while it is still pending.
 */
const NOT_FOUND_GRACE_RETRIES = 10;

@Injectable({
    providedIn: 'root',
})
export class QueueService {
    private readonly http = inject(HttpClient);
    private readonly apiBaseUrl = inject(API_BASE_URL);
    private readonly log = inject(LogService);

    getQueueStats(): Observable<QueueStats> {
        return this.http.get<QueueStats>(`${this.apiBaseUrl}/queue/stats`).pipe(
            tap({ error: (err) => this.log.error('QueueService.getQueueStats failed', 'QueueService', { error: err instanceof Error ? err.message : String(err) }) }),
        );
    }

    /**
     * Polls /queue/results/:requestId every intervalMs until the job reaches a terminal state.
     *
     * `not_found` is treated as non-terminal for the first NOT_FOUND_GRACE_RETRIES polls because
     * the backend only writes a result to history on completion/failed/cancelled — a pending job
     * will return `not_found` until it finishes.  After the grace budget is exhausted the job is
     * considered truly missing and polling stops.
     *
     * @param requestId - The unique identifier of the async compilation job to poll.
     * @param intervalMs - Polling interval in milliseconds. Defaults to 3000ms.
     */
    pollResults(requestId: string, intervalMs = 3000): Observable<QueueJobResult> {
        this.log.debug('pollResults: start', 'QueueService', { requestId, intervalMs });
        return interval(intervalMs).pipe(
            startWith(0),
            switchMap(() =>
                this.http.get<QueueJobResult>(`${this.apiBaseUrl}/queue/results/${requestId}`),
            ),
            scan(
                (acc, result) => ({
                    result,
                    notFoundCount: result.status === 'not_found' ? acc.notFoundCount + 1 : 0,
                }),
                { result: null as unknown as QueueJobResult, notFoundCount: 0 },
            ),
            takeWhile(
                ({ result, notFoundCount }) =>
                    !TERMINAL_JOB_STATUSES.includes(result.status) &&
                    !(result.status === 'not_found' && notFoundCount > NOT_FOUND_GRACE_RETRIES),
                true,
            ),
            // unwrap the scan accumulator back to QueueJobResult
            switchMap(({ result }) => [result]),
            tap(result => {
                if (result.status === 'completed') {
                    this.log.info('pollResults: job completed', 'QueueService', { requestId });
                } else if (result.status === 'failed') {
                    this.log.warn('pollResults: job failed', 'QueueService', { requestId, error: result.error });
                }
            }),
        );
    }
}
