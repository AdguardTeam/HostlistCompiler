import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID, signal, computed, WritableSignal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { ApiKeysComponent } from './api-keys.component';
import { ApiKeyService, ApiKey } from '../../services/api-key.service';
import { ClerkService } from '../../services/clerk.service';
import { MatSnackBar } from '@angular/material/snack-bar';

const MOCK_KEY: ApiKey = {
    id: 'key-1',
    keyPrefix: 'abc_1234',
    name: 'Test Key',
    scopes: ['compile'],
    rateLimitPerMinute: 60,
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
};

describe('ApiKeysComponent', () => {
    let fixture: ComponentFixture<ApiKeysComponent>;
    let component: ApiKeysComponent;

    // Signal-based mocks — must be real signals since the template reads them
    let keysSignal: WritableSignal<ApiKey[]>;
    let loadingSignal: WritableSignal<boolean>;
    let errorSignal: WritableSignal<string | null>;
    let isSignedInSignal: WritableSignal<boolean>;
    let isLoadedSignal: WritableSignal<boolean>;

    let mockApiKeyService: Record<string, unknown>;
    let mockClerkService: Record<string, unknown>;

    beforeEach(async () => {
        // Fresh writable signals each test
        keysSignal = signal<ApiKey[]>([]);
        loadingSignal = signal(false);
        errorSignal = signal<string | null>(null);
        isSignedInSignal = signal(true);
        isLoadedSignal = signal(true);

        const countSignal = computed(() => keysSignal().length);
        const activeKeysSignal = computed(() => keysSignal().filter((k) => !k.revokedAt));

        mockApiKeyService = {
            keys: keysSignal.asReadonly(),
            loading: loadingSignal.asReadonly(),
            error: errorSignal.asReadonly(),
            count: countSignal,
            activeKeys: activeKeysSignal,
            loadKeys: vi.fn().mockResolvedValue(undefined),
            createKey: vi.fn().mockResolvedValue(null),
            revokeKey: vi.fn().mockResolvedValue(true),
            updateKey: vi.fn().mockResolvedValue(true),
        };

        mockClerkService = {
            isSignedIn: isSignedInSignal.asReadonly(),
            isLoaded: isLoadedSignal.asReadonly(),
            user: signal(null).asReadonly(),
            userId: signal('user_123').asReadonly(),
            getToken: vi.fn().mockResolvedValue('mock-token'),
        };

        await TestBed.configureTestingModule({
            imports: [ApiKeysComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideAnimationsAsync(),
                provideRouter([]),
                { provide: PLATFORM_ID, useValue: 'browser' },
                { provide: ApiKeyService, useValue: mockApiKeyService },
                { provide: ClerkService, useValue: mockClerkService },
                { provide: MatSnackBar, useValue: { open: vi.fn() } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ApiKeysComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should call loadKeys on init when signed in', () => {
        fixture.detectChanges();
        expect(mockApiKeyService['loadKeys']).toHaveBeenCalled();
    });

    it('should not call loadKeys on init when not signed in', () => {
        isSignedInSignal.set(false);
        fixture.detectChanges();
        expect(mockApiKeyService['loadKeys']).not.toHaveBeenCalled();
    });

    it('should render page title', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('API Keys');
    });

    it('should show sign-in message when not authenticated', () => {
        isSignedInSignal.set(false);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('sign in');
    });

    it('should show empty state when no keys', () => {
        keysSignal.set([]);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('No API keys yet');
    });

    it('should render key list when keys exist', () => {
        keysSignal.set([MOCK_KEY]);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('Test Key');
        expect(el.textContent).toContain('abc_1234');
    });

    it('should show loading spinner when loading', () => {
        loadingSignal.set(true);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const spinner = el.querySelector('mat-spinner');
        expect(spinner).toBeTruthy();
    });

    it('should show error message when error is set', () => {
        errorSignal.set('Something went wrong');
        keysSignal.set([MOCK_KEY]);
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.textContent).toContain('Something went wrong');
    });

    it('should compute isExpired correctly', () => {
        fixture.detectChanges();
        expect(component.isExpired({ expiresAt: '2020-01-01T00:00:00Z', revokedAt: null })).toBe(true);
        expect(component.isExpired({ expiresAt: '2099-01-01T00:00:00Z', revokedAt: null })).toBe(false);
        expect(component.isExpired({ expiresAt: null, revokedAt: null })).toBe(false);
        expect(component.isExpired({ expiresAt: '2020-01-01T00:00:00Z', revokedAt: '2025-01-01T00:00:00Z' })).toBe(false);
    });
});
