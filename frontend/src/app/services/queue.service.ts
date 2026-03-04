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
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';
import { LogService } from './log.service';

export interface QueueStats {
    readonly currentDepth: number;
    readonly pending: number;
    readonly completed: number;
    readonly failed: number;
    readonly processingRate: number;
    readonly lag: number;
    readonly depthHistory: DepthHistoryEntry[];
    readonly history?: QueueJobEntry[];
}

export interface DepthHistoryEntry {
    readonly timestamp: string;
    readonly depth: number;
}

export interface QueueJobEntry {
    readonly requestId: string;
    readonly configName?: string;
    readonly status: 'pending' | 'processing' | 'completed' | 'failed';
    readonly duration?: number;
    readonly completedAt?: string;
}

export interface QueueResult {
    readonly success: boolean;
    readonly status: 'pending' | 'processing' | 'completed' | 'failed';
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
     * @param requestId  - The async job request ID
     * @param intervalMs - Polling interval in milliseconds (default 5000)
     */
    pollResults(requestId: string, intervalMs = 5000): Observable<QueueResult> {
        this.log.info(`Starting poll for job ${requestId}`, 'queue', { requestId, intervalMs });

        return timer(0, intervalMs).pipe(
            switchMap(() => this.getResults(requestId)),
            takeWhile(
                (result) => result.status === 'pending' || result.status === 'processing',
                true, // include the terminal emission
            ),
            map(result => {
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
                }
                return result;
            }),
        );
    }
}
