import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserButtonComponent } from './user-button.component';
import { ClerkService } from '../../services/clerk.service';
import { ThemeService } from '../../services/theme.service';

describe('UserButtonComponent', () => {
    let component: UserButtonComponent;
    let fixture: ComponentFixture<UserButtonComponent>;
    let mockClerkService: {
        isLoaded: ReturnType<typeof signal<boolean>>;
        isSignedIn: ReturnType<typeof signal<boolean>>;
        mountUserButton: ReturnType<typeof vi.fn>;
        unmountUserButton: ReturnType<typeof vi.fn>;
    };
    let mockThemeService: { isDark: ReturnType<typeof signal<boolean>> };

    beforeEach(async () => {
        mockClerkService = {
            isLoaded: signal(true),
            isSignedIn: signal(false),
            mountUserButton: vi.fn(),
            unmountUserButton: vi.fn(),
        };
        mockThemeService = { isDark: signal(false) };

        await TestBed.configureTestingModule({
            imports: [UserButtonComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([]),
                { provide: ClerkService, useValue: mockClerkService },
                { provide: ThemeService, useValue: mockThemeService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(UserButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should not render anything while Clerk is loading', () => {
        mockClerkService.isLoaded.set(false);
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeNull();
        expect(compiled.querySelector('.auth-links')).toBeNull();
    });

    it('should render sign-in/sign-up links when loaded and not signed in', () => {
        mockClerkService.isLoaded.set(true);
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.auth-links')).toBeTruthy();
        expect(compiled.querySelector('a[href="/sign-in"]')).toBeTruthy();
        expect(compiled.querySelector('a[href="/sign-up"]')).toBeTruthy();
        expect(compiled.querySelector('.user-button-container')).toBeNull();
    });

    it('should not render user button container when not signed in', () => {
        mockClerkService.isLoaded.set(true);
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.user-button-container');
        expect(container).toBeNull();
    });

    it('should render user button container when signed in', () => {
        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.user-button-container');
        expect(container).toBeTruthy();
        expect(compiled.querySelector('.auth-links')).toBeNull();
    });

    it('should mount user button when signed in and container is available', async () => {
        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();

        // Wait for microtask queue to flush (queueMicrotask in component)
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockClerkService.mountUserButton).toHaveBeenCalled();
        const callArg = mockClerkService.mountUserButton.mock.calls[0][0];
        expect(callArg).toBeInstanceOf(HTMLDivElement);
    });

    it('should not mount user button multiple times', async () => {
        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();

        // Wait for initial mount
        await new Promise((resolve) => setTimeout(resolve, 0));

        const initialCallCount = mockClerkService.mountUserButton.mock.calls.length;

        // Trigger another change detection cycle
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Should not have called mount again
        expect(mockClerkService.mountUserButton).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should remount when user signs in after component creation', async () => {
        // Start signed out
        mockClerkService.isLoaded.set(true);
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();

        expect(mockClerkService.mountUserButton).not.toHaveBeenCalled();

        // Sign in
        mockClerkService.isSignedIn.set(true);
        TestBed.flushEffects();
        fixture.detectChanges();

        // Wait for microtask to complete
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockClerkService.mountUserButton).toHaveBeenCalledTimes(1);
    });

    it('should unmount user button on destroy', () => {
        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const containerElement = compiled.querySelector('.user-button-container') as HTMLDivElement;

        fixture.destroy();

        expect(mockClerkService.unmountUserButton).toHaveBeenCalledTimes(1);
        expect(mockClerkService.unmountUserButton).toHaveBeenCalledWith(containerElement);
    });

    it('should handle missing container gracefully on destroy', () => {
        const mockClerkNoContainer = {
            isLoaded: signal(true),
            isSignedIn: signal(false),
            mountUserButton: vi.fn(),
            unmountUserButton: vi.fn(),
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [UserButtonComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([]),
                { provide: ClerkService, useValue: mockClerkNoContainer },
                { provide: ThemeService, useValue: { isDark: signal(false) } },
            ],
        });

        const tempFixture = TestBed.createComponent(UserButtonComponent);
        const tempComponent = tempFixture.componentInstance;

        // Manually set container to undefined to simulate missing element
        (tempComponent as any).container = () => undefined;

        // Should not throw when destroying
        expect(() => tempFixture.destroy()).not.toThrow();
        expect(mockClerkNoContainer.unmountUserButton).not.toHaveBeenCalled();
    });

    it('should reset mounted flag when user signs out', async () => {
        // Sign in and mount
        mockClerkService.isSignedIn.set(true);
        TestBed.flushEffects();
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const initialMountCalls = mockClerkService.mountUserButton.mock.calls.length;
        expect(initialMountCalls).toBeGreaterThan(0);

        // Sign out
        mockClerkService.isSignedIn.set(false);
        TestBed.flushEffects();
        fixture.detectChanges();

        // Sign back in
        mockClerkService.isSignedIn.set(true);
        TestBed.flushEffects();
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Should have mounted again
        expect(mockClerkService.mountUserButton.mock.calls.length).toBeGreaterThan(initialMountCalls);
    });

    it('should use correct CSS class for container', () => {
        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.user-button-container');

        expect(container).toBeTruthy();
        expect(container?.classList.contains('user-button-container')).toBe(true);
    });

    it('should conditionally render based on isSignedIn signal', () => {
        // Test @if control flow
        mockClerkService.isLoaded.set(true);
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();
        let compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeNull();
        expect(compiled.querySelector('.auth-links')).toBeTruthy();

        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();
        compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeTruthy();
        expect(compiled.querySelector('.auth-links')).toBeNull();

        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();
        compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeNull();
        expect(compiled.querySelector('.auth-links')).toBeTruthy();
    });

    it('should unmount and remount when theme changes while signed in', async () => {
        // Sign in and wait for the widget to mount
        mockClerkService.isSignedIn.set(true);
        TestBed.flushEffects();
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const mountCallsBefore = mockClerkService.mountUserButton.mock.calls.length;
        expect(mountCallsBefore).toBeGreaterThan(0);

        // Toggle theme while the widget is mounted
        mockThemeService.isDark.set(true);
        TestBed.flushEffects();

        // Widget should have been unmounted once and then remounted
        expect(mockClerkService.unmountUserButton).toHaveBeenCalledTimes(1);
        expect(mockClerkService.mountUserButton.mock.calls.length).toBeGreaterThan(mountCallsBefore);
    });

    it('should not remount when theme changes before initial mount', () => {
        // isSignedIn is false — no container, nothing mounted
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();

        mockThemeService.isDark.set(true);
        TestBed.flushEffects();

        // No unmount or mount should occur since the widget was never mounted
        expect(mockClerkService.unmountUserButton).not.toHaveBeenCalled();
        // mountUserButton may have been called 0 times from afterNextRender (no container)
        expect(mockClerkService.mountUserButton).not.toHaveBeenCalled();
    });
});
