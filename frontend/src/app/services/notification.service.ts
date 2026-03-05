/**
 * NotificationService — Toast notifications, browser notifications, and async job tracking.
 *
 * Provides:
 *   - Signal-driven toast notification list for in-page display
 *   - Browser Notification API integration for background job completion
 *   - Async job tracking with automatic polling via QueueService
 *
 * Angular 21 Pattern: Injectable with signal state, inject(), SSR-safe guards
 */

import { Injectable, inject, signal, PLATFORM_ID, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LogService } from './log.service';
import { QueueService, type QueueResult } from './queue.service';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    readonly id: string;
    readonly type: ToastType;
    readonly title: string;
    readonly message: string;
    readonly timestamp: Date;
}

export interface TrackedJob {
    readonly configName: string;
    readonly startTime: number;
    notified: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly log = inject(LogService);
    private readonly queueService = inject(QueueService);
    private readonly destroyRef = inject(DestroyRef);

    /** Active toast notifications */
    readonly toasts = signal<Toast[]>([]);

    /** Whether browser notifications are enabled */
    readonly isEnabled = signal(false);

    /** Currently tracked async jobs */
    readonly trackedJobs = signal<Map<string, TrackedJob>>(new Map());

    private toastCounter = 0;
    private jobMonitorInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.loadPreferences();
        this.destroyRef.onDestroy(() => this.stopJobMonitor());
    }

    /**
     * Show a toast notification (in-page).
     * Auto-dismisses after 5 seconds.
     */
    showToast(type: ToastType, title: string, message: string): void {
        const id = `toast-${++this.toastCounter}-${Date.now()}`;
        const toast: Toast = { id, type, title, message, timestamp: new Date() };

        this.toasts.update(list => [...list, toast]);

        // Auto-remove after 5s
        setTimeout(() => this.dismissToast(id), 5000);
    }

    /** Remove a toast by ID */
    dismissToast(id: string): void {
        this.toasts.update(list => list.filter(t => t.id !== id));
    }

    /**
     * Request browser notification permission.
     * Persists preference to localStorage.
     */
    async requestPermission(): Promise<boolean> {
        if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) {
            this.showToast('error', 'Not Supported', 'Browser notifications are not supported');
            return false;
        }

        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';

        this.isEnabled.set(granted);
        this.persistPreference(granted);

        this.log.info(`Browser notification permission: ${permission}`, 'notification');

        if (granted) {
            this.showToast('success', 'Notifications Enabled', 'You will be notified when async jobs complete');
            new Notification('Adblock Compiler', {
                body: 'Notifications are now enabled!',
                icon: '/favicon.svg',
            });
        } else {
            this.showToast('warning', 'Permission Denied', 'Please allow notifications in your browser settings');
        }

        return granted;
    }

    /** Toggle notifications on/off */
    async toggleNotifications(): Promise<void> {
        if (this.isEnabled()) {
            this.isEnabled.set(false);
            this.persistPreference(false);
            this.showToast('info', 'Notifications Disabled', 'You will no longer receive notifications');
            this.log.info('Browser notifications disabled', 'notification');
        } else {
            await this.requestPermission();
        }
    }

    /**
     * Track an async compilation job.
     * Starts polling for results and notifies on completion.
     */
    trackJob(requestId: string, configName: string): void {
        this.trackedJobs.update(jobs => {
            const updated = new Map(jobs);
            updated.set(requestId, { configName, startTime: Date.now(), notified: false });
            return updated;
        });

        this.log.info(`Tracking async job: ${requestId}`, 'notification', { requestId, configName });

        // Start polling for this job
        const sub = this.queueService.pollResults(requestId).subscribe({
            next: (result: QueueResult) => {
                if (result.status === 'completed') {
                    this.notifyJobComplete(requestId, configName, result.duration ?? 0);
                } else if (result.status === 'cancelled') {
                    this.showToast('warning', 'Job Cancelled', `${configName} was cancelled`);
                    this.markJobNotified(requestId);
                } else if (result.status === 'failed') {
                    this.showToast('error', 'Job Failed', `${configName} failed: ${result.error ?? 'Unknown error'}`);
                    this.markJobNotified(requestId);
                }
            },
            error: (err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                this.log.error(`Poll error for job ${requestId}: ${message}`, 'notification');
            },
        });

        this.destroyRef.onDestroy(() => sub.unsubscribe());
    }

    /** Send browser + toast notification for a completed job */
    private notifyJobComplete(requestId: string, configName: string, duration: number): void {
        const durationStr = duration > 0 ? ` in ${Math.round(duration)}ms` : '';

        // Browser notification
        if (this.isEnabled() && isPlatformBrowser(this.platformId) && Notification.permission === 'granted') {
            new Notification('Compilation Complete', {
                body: `${configName} compiled${durationStr}`,
                icon: '/favicon.svg',
            });
        }

        // In-page toast
        this.showToast('success', 'Async Job Complete', `${configName} finished${durationStr}`);
        this.markJobNotified(requestId);

        this.log.info(`Job ${requestId} notification sent`, 'notification', { requestId, configName, duration });
    }

    private markJobNotified(requestId: string): void {
        this.trackedJobs.update(jobs => {
            const updated = new Map(jobs);
            const job = updated.get(requestId);
            if (job) {
                updated.set(requestId, { ...job, notified: true });
            }
            // Clean up notified jobs after 60s
            setTimeout(() => {
                this.trackedJobs.update(j => {
                    const cleaned = new Map(j);
                    cleaned.delete(requestId);
                    return cleaned;
                });
            }, 60_000);
            return updated;
        });
    }

    private stopJobMonitor(): void {
        if (this.jobMonitorInterval) {
            clearInterval(this.jobMonitorInterval);
            this.jobMonitorInterval = null;
        }
    }

    private loadPreferences(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const stored = localStorage.getItem('notificationsEnabled');
            if (stored === 'true' && 'Notification' in window && Notification.permission === 'granted') {
                this.isEnabled.set(true);
            }
        } catch {
            // localStorage may not be available
        }
    }

    private persistPreference(enabled: boolean): void {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            localStorage.setItem('notificationsEnabled', String(enabled));
        } catch {
            // Silently ignore storage errors
        }
    }
}
