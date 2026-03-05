import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ApiTesterComponent } from './api-tester.component';
import { API_BASE_URL } from '../tokens';

describe('ApiTesterComponent', () => {
    let component: ApiTesterComponent;
    let fixture: ComponentFixture<ApiTesterComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ApiTesterComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideAnimationsAsync(),
                { provide: API_BASE_URL, useValue: 'http://localhost/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ApiTesterComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should start collapsed', () => {
        expect(component.collapsed()).toBe(true);
    });

    it('should have default endpoints', () => {
        expect(component.endpoints.length).toBeGreaterThan(0);
        expect(component.endpoints[0].value).toBe('/api');
    });

    it('should default to /api endpoint', () => {
        expect(component.selectedEndpoint).toBe('/api');
    });

    it('should identify POST endpoints', () => {
        component.selectedEndpoint = '/compile';
        expect(component.isPostEndpoint()).toBe(true);
    });

    it('should identify GET endpoints', () => {
        component.selectedEndpoint = '/api';
        expect(component.isPostEndpoint()).toBe(false);
    });

    it('should return correct status class for 2xx', () => {
        component.response.set({ status: 200, statusText: 'OK', data: {} });
        expect(component.statusClass()).toBe('success');
    });

    it('should return correct status class for 4xx', () => {
        component.response.set({ status: 404, statusText: 'Not Found', data: {} });
        expect(component.statusClass()).toBe('warning');
    });

    it('should return correct status class for 5xx', () => {
        component.response.set({ status: 500, statusText: 'Error', data: {} });
        expect(component.statusClass()).toBe('error');
    });

    it('should return info when no response', () => {
        expect(component.statusClass()).toBe('info');
    });

    it('should format response as highlighted JSON', () => {
        component.response.set({ status: 200, statusText: 'OK', data: { key: 'value' } });
        const formatted = component.formattedResponse();
        expect(formatted).toContain('json-key');
        expect(formatted).toContain('json-string');
    });

    it('should return empty string when no response data', () => {
        expect(component.formattedResponse()).toBe('');
    });

    it('should reset response on endpoint change', () => {
        component.response.set({ status: 200, statusText: 'OK', data: {} });
        component.onEndpointChange();
        expect(component.response()).toBeNull();
    });

    it('should reset response', () => {
        component.response.set({ status: 200, statusText: 'OK', data: {} });
        component.resetResponse();
        expect(component.response()).toBeNull();
    });

    it('should set loading state during request', async () => {
        const mockResponse = { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve({ test: true }) };
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as Response);

        expect(component.isLoading()).toBe(false);
        const promise = component.sendRequest();
        expect(component.isLoading()).toBe(true);
        await promise;
        expect(component.isLoading()).toBe(false);
    });

    it('should handle network error in sendRequest', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

        await component.sendRequest();

        expect(component.response()?.status).toBe(0);
        expect(component.response()?.statusText).toBe('Network Error');
    });

    it('should have a default request body for POST', () => {
        expect(component.requestBody).toBeTruthy();
        expect(() => JSON.parse(component.requestBody)).not.toThrow();
    });
});
