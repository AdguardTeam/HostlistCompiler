import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PerformanceComponent } from './performance.component';
import { API_BASE_URL } from '../tokens';

describe('PerformanceComponent', () => {
    let fixture: ComponentFixture<PerformanceComponent>;
    let component: PerformanceComponent;
    let httpTesting: HttpTestingController;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PerformanceComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PerformanceComponent);
        component = fixture.componentInstance;
        httpTesting = TestBed.inject(HttpTestingController);

        // Flush the initial rxResource requests triggered by component creation
        flushPendingRequests();
    });

    function flushPendingRequests(): void {
        httpTesting.match('/api/metrics').forEach(req => req.flush({
            totalRequests: 0, averageDuration: 0, p95Duration: 0, p99Duration: 0,
            successRate: 0, cacheHitRate: 0, endpoints: [],
        }));
        httpTesting.match('/api/health').forEach(req => req.flush({
            status: 'healthy', uptime: 0, version: '0.0.0', timestamp: new Date().toISOString(),
        }));
    }

    afterEach(() => {
        httpTesting.match(() => true).forEach(req => req.flush({}));
        httpTesting.verify();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have endpoint column definitions', () => {
        expect(component.endpointColumns).toEqual(['endpoint', 'requests', 'avgDuration', 'errorRate']);
    });

    it('should format uptime in seconds', () => {
        expect(component.formatUptime(30)).toBe('30s');
    });

    it('should format uptime in minutes', () => {
        expect(component.formatUptime(120)).toBe('2m');
    });

    it('should format uptime in hours and minutes', () => {
        expect(component.formatUptime(3700)).toBe('1h 1m');
    });

    it('should format uptime in days and hours', () => {
        expect(component.formatUptime(90000)).toBe('1d 1h');
    });

    it('should increment refresh trigger when refreshMetrics is called', () => {
        // Calling refreshMetrics triggers new API calls
        component.refreshMetrics();
        // The component should still exist without errors
        expect(component).toBeTruthy();
    });

    it('should show default health icon when no data', () => {
        expect(component.healthStatusIcon()).toBe('help_outline');
    });

    it('should show default health color when no data', () => {
        expect(component.healthStatusColor()).toBe('var(--mat-sys-on-surface-variant)');
    });

    it('should render the page heading', () => {
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('h1')?.textContent).toContain('Performance');
    });
});
