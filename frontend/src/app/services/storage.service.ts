/**
 * StorageService — wraps the /admin/storage/* endpoints.
 *
 * All requests require the X-Admin-Key header, which is added
 * automatically by the error interceptor from AuthService.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ADMIN_BASE_URL } from '../tokens';
import { AuthService } from './auth.service';

export interface StorageStats {
    readonly kvKeys: number;
    readonly r2Objects: number;
    readonly d1Tables: number;
    readonly cacheEntries: number;
    readonly totalSize?: string;
}

export interface TableInfo {
    readonly name: string;
    readonly rowCount: number;
    readonly columns: string[];
}

export interface QueryResult {
    readonly success: boolean;
    readonly columns: string[];
    readonly rows: unknown[][];
    readonly rowCount: number;
    readonly duration?: string;
}

@Injectable({
    providedIn: 'root',
})
export class StorageService {
    private readonly http = inject(HttpClient);
    private readonly adminBaseUrl = inject(ADMIN_BASE_URL);
    private readonly auth = inject(AuthService);

    private get headers(): HttpHeaders {
        return new HttpHeaders({ 'X-Admin-Key': this.auth.adminKey() });
    }

    getStats(): Observable<StorageStats> {
        return this.http.get<StorageStats>(
            `${this.adminBaseUrl}/stats`,
            { headers: this.headers },
        );
    }

    getTables(): Observable<TableInfo[]> {
        return this.http.get<TableInfo[]>(
            `${this.adminBaseUrl}/tables`,
            { headers: this.headers },
        );
    }

    query(sql: string): Observable<QueryResult> {
        return this.http.post<QueryResult>(
            `${this.adminBaseUrl}/query`,
            { sql },
            { headers: this.headers },
        );
    }

    clearCache(): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.adminBaseUrl}/clear-cache`,
            {},
            { headers: this.headers },
        );
    }

    clearExpired(): Observable<{ success: boolean; removed: number }> {
        return this.http.post<{ success: boolean; removed: number }>(
            `${this.adminBaseUrl}/clear-expired`,
            {},
            { headers: this.headers },
        );
    }

    vacuum(): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.adminBaseUrl}/vacuum`,
            {},
            { headers: this.headers },
        );
    }

    exportData(): Observable<Blob> {
        return this.http.get(
            `${this.adminBaseUrl}/export`,
            { headers: this.headers, responseType: 'blob' },
        );
    }
}
