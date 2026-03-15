import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NEVER } from 'rxjs';
import { StorageComponent } from './storage.component';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';

// ============================================================================
// Mocks
// ============================================================================

function createMockAuthService(authenticated = false) {
    const keySignal = signal(authenticated ? 'test-key' : '');
    return {
        adminKey: keySignal,
        isAuthenticated: vi.fn(() => authenticated),
        setKey: vi.fn((key: string) => keySignal.set(key)),
        clearKey: vi.fn(() => keySignal.set('')),
    };
}

function createMockStorageService() {
    return {
        getStats: vi.fn(() => NEVER),
        clearCache: vi.fn(() => NEVER),
        clearExpired: vi.fn(() => NEVER),
        vacuum: vi.fn(() => NEVER),
        exportData: vi.fn(() => NEVER),
        query: vi.fn(() => NEVER),
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('StorageComponent', () => {
    let fixture: ComponentFixture<StorageComponent>;
    let component: StorageComponent;
    let mockAuth: ReturnType<typeof createMockAuthService>;
    let mockStorage: ReturnType<typeof createMockStorageService>;

    async function setup(authenticated = false) {
        mockAuth = createMockAuthService(authenticated);
        mockStorage = createMockStorageService();

        await TestBed.configureTestingModule({
            imports: [StorageComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: AuthService, useValue: mockAuth },
                { provide: StorageService, useValue: mockStorage },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(StorageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    describe('unauthenticated state', () => {
        beforeEach(async () => { await setup(false); });

        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('should show auth card when not authenticated', () => {
            const el: HTMLElement = fixture.nativeElement;
            expect(el.textContent).toContain('Authentication Required');
        });

        it('should not show authenticated content when not authenticated', () => {
            const el: HTMLElement = fixture.nativeElement;
            expect(el.textContent).not.toContain('Authenticated');
        });
    });

    describe('authenticated state', () => {
        beforeEach(async () => { await setup(true); });

        it('should show authenticated content', () => {
            const el: HTMLElement = fixture.nativeElement;
            expect(el.textContent).toContain('Authenticated');
        });

        it('should not show auth card when authenticated', () => {
            const el: HTMLElement = fixture.nativeElement;
            expect(el.textContent).not.toContain('Authentication Required');
        });
    });

    describe('authenticate()', () => {
        beforeEach(async () => { await setup(false); });

        it('should call setKey when keyInput is non-empty', () => {
            component.keyInput = 'my-admin-key';
            component.authenticate();
            expect(mockAuth.setKey).toHaveBeenCalledWith('my-admin-key');
        });

        it('should clear keyInput after authenticate()', () => {
            component.keyInput = 'my-admin-key';
            component.authenticate();
            expect(component.keyInput).toBe('');
        });

        it('should not call setKey when keyInput is blank', () => {
            component.keyInput = '   ';
            component.authenticate();
            expect(mockAuth.setKey).not.toHaveBeenCalled();
        });
    });

    describe('destructive SQL blocking', () => {
        beforeEach(async () => { await setup(true); });

        const destructiveStatements = ['DROP TABLE users', 'DELETE FROM logs', 'INSERT INTO t VALUES(1)', 'UPDATE users SET x=1', 'TRUNCATE audit_log', 'ALTER TABLE t ADD COLUMN x'];

        for (const sql of destructiveStatements) {
            it(`should block destructive SQL — ${sql.split(' ')[0]}`, () => {
                component.sqlInput = sql;
                component.runQuery();
                expect(component.sqlWarning()).toBeTruthy();
            });
        }

        it('should clear sqlWarning for a safe SELECT query', () => {
            component.sqlInput = 'SELECT * FROM tier_configs';
            component.runQuery();
            expect(component.sqlWarning()).toBeNull();
        });

        it('should not execute query when sqlInput is empty', () => {
            component.sqlInput = '';
            component.runQuery();
            // runQuery returns early for empty input; sqlWarning stays null
            expect(component.sqlWarning()).toBeNull();
        });
    });
});
