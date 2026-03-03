import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AdminComponent } from './admin.component';
import { AuthService } from '../services/auth.service';
import { API_BASE_URL } from '../tokens';

describe('AdminComponent', () => {
    let fixture: ComponentFixture<AdminComponent>;
    let component: AdminComponent;
    let auth: AuthService;
    let httpTesting: HttpTestingController;

    beforeEach(async () => {
        sessionStorage.clear();
        await TestBed.configureTestingModule({
            imports: [AdminComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AdminComponent);
        component = fixture.componentInstance;
        auth = TestBed.inject(AuthService);
        httpTesting = TestBed.inject(HttpTestingController);
        await fixture.whenStable();
    });

    afterEach(() => {
        httpTesting.verify({ ignoreCancelled: true });
        sessionStorage.clear();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should start with empty key input', () => {
        expect(component.keyInput).toBe('');
    });

    it('should start with empty sql input', () => {
        expect(component.sqlInput).toBe('');
    });

    it('should start unauthenticated', () => {
        expect(component.auth.isAuthenticated()).toBe(false);
    });

    it('should authenticate with a valid key', async () => {
        component.keyInput = 'my-admin-key';
        component.authenticate();

        expect(auth.isAuthenticated()).toBe(true);
        expect(auth.adminKey()).toBe('my-admin-key');
        expect(component.keyInput).toBe(''); // cleared after auth
    });

    it('should not authenticate with empty key', () => {
        component.keyInput = '  ';
        component.authenticate();
        expect(auth.isAuthenticated()).toBe(false);
    });

    it('should set action result on clearCache success', () => {
        auth.setKey('test-key');
        component.clearCache();

        const req = httpTesting.expectOne('/admin/storage/clear-cache');
        req.flush({ success: true });

        expect(component.actionResult()).toBe('Cache cleared successfully');
    });

    it('should set action result on clearCache error', () => {
        auth.setKey('test-key');
        component.clearCache();

        const req = httpTesting.expectOne('/admin/storage/clear-cache');
        req.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

        expect(component.actionResult()).toContain('Error');
    });

    it('should set action result with removed count on clearExpired', () => {
        auth.setKey('test-key');
        component.clearExpired();

        const req = httpTesting.expectOne('/admin/storage/clear-expired');
        req.flush({ success: true, removed: 7 });

        expect(component.actionResult()).toBe('Removed 7 expired entries');
    });

    it('should set action result on vacuum success', () => {
        auth.setKey('test-key');
        component.vacuum();

        const req = httpTesting.expectOne('/admin/storage/vacuum');
        req.flush({ success: true });

        expect(component.actionResult()).toBe('Database vacuumed successfully');
    });

    it('should render the page heading', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('h1')?.textContent).toContain('Storage Admin');
    });

    it('should show auth card when not authenticated', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.auth-card')).toBeTruthy();
    });
});
