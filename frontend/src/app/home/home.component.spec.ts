import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './home.component';
import { API_BASE_URL } from '../tokens';

describe('HomeComponent', () => {
    let fixture: ComponentFixture<HomeComponent>;
    let component: HomeComponent;
    let httpTesting: HttpTestingController;
    let router: Router;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HomeComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideRouter([]),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(HomeComponent);
        component = fixture.componentInstance;
        httpTesting = TestBed.inject(HttpTestingController);
        router = TestBed.inject(Router);

        // Flush the initial rxResource requests triggered by component creation
        flushPendingRequests();
    });

    function flushPendingRequests(): void {
        httpTesting.match('/api/metrics').forEach(req => req.flush({
            totalRequests: 0, averageDuration: 0, cacheHitRate: 0, successRate: 0,
        }));
        httpTesting.match('/api/health').forEach(req => req.flush({
            status: 'healthy', version: '0.0.0',
        }));
    }

    afterEach(() => {
        httpTesting.match(() => true).forEach(req => req.flush({}));
        httpTesting.verify();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have 5 navigation cards', () => {
        expect(component.navCards.length).toBe(5);
    });

    it('should include Compiler card', () => {
        const compiler = component.navCards.find(c => c.path === '/compiler');
        expect(compiler).toBeTruthy();
        expect(compiler!.title).toBe('Filter List Compiler');
    });

    it('should include Admin card with warn tag', () => {
        const admin = component.navCards.find(c => c.path === '/admin');
        expect(admin).toBeTruthy();
        expect(admin!.tagColor).toBe('warn');
    });

    it('should derive live stats from metrics', () => {
        // After flushing with zeroed metrics, stats show formatted values
        const stats = component.liveStats();
        expect(stats.length).toBe(4);
        expect(stats[0].label).toBe('Total Requests');
        expect(stats[0].value).toBe('0');
    });

    it('should navigate when navigateTo is called', () => {
        const navigateSpy = vi.spyOn(router, 'navigate');
        component.navigateTo('/compiler');
        expect(navigateSpy).toHaveBeenCalledWith(['/compiler']);
    });

    it('should navigate to performance on stat card click for Total Requests', () => {
        const navigateSpy = vi.spyOn(router, 'navigate');
        component.onStatCardClicked('Total Requests');
        expect(navigateSpy).toHaveBeenCalledWith(['/performance']);
    });

    it('should navigate to performance on stat card click for Avg Response Time', () => {
        const navigateSpy = vi.spyOn(router, 'navigate');
        component.onStatCardClicked('Avg Response Time');
        expect(navigateSpy).toHaveBeenCalledWith(['/performance']);
    });

    it('should not navigate for non-metric stat card clicks', () => {
        const navigateSpy = vi.spyOn(router, 'navigate');
        component.onStatCardClicked('Cache Hit Rate');
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should show default health icon when no data', () => {
        // After flushing with healthy status, icon reflects healthy state
        expect(component.healthIcon()).toBe('check_circle');
    });

    it('should show default health color when no data', () => {
        // After flushing with healthy status, color reflects healthy state
        expect(component.healthColor()).toBe('var(--mat-sys-primary)');
    });

    it('should render the page heading', () => {
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('h1')?.textContent).toContain('Adblock Compiler Dashboard');
    });
});
