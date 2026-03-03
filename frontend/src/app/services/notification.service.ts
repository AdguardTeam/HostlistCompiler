/**
 * NotificationService — Tracks async compilation jobs by requestId.
 */
import { Injectable, signal } from '@angular/core';

export interface AsyncJobRecord {
    requestId: string;
    configName: string;
    status: 'queued' | 'completed' | 'failed';
    createdAt: Date;
    completedAt?: Date;
    ruleCount?: number;
    error?: string;
}

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private readonly _jobs = signal<AsyncJobRecord[]>([]);
    readonly jobs = this._jobs.asReadonly();

    addJob(requestId: string, configName: string): void {
        this._jobs.update(jobs => [
            { requestId, configName, status: 'queued', createdAt: new Date() },
            ...jobs,
        ]);
    }

    /**
     * Updates a job that has reached a terminal state.
     * Only 'completed' and 'failed' are accepted because a job transitions from
     * 'queued' to a terminal state — it is never moved back to 'queued' after creation.
     */
    updateJob(requestId: string, status: 'completed' | 'failed', data?: Pick<AsyncJobRecord, 'ruleCount' | 'error'>): void {
        this._jobs.update(jobs =>
            jobs.map(job =>
                job.requestId === requestId
                    ? { ...job, status, completedAt: new Date(), ...data }
                    : job,
            ),
        );
    }
}
