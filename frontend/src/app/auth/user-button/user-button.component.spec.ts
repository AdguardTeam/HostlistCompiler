import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserButtonComponent } from './user-button.component';
import { ClerkService } from '../../services/clerk.service';

describe('UserButtonComponent', () => {
    let component: UserButtonComponent;
    let fixture: ComponentFixture<UserButtonComponent>;
    let mockClerkService: {
        isSignedIn: ReturnType<typeof signal<boolean>>;
        mountUserButton: ReturnType<typeof vi.fn>;
        unmountUserButton: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockClerkService = {
            isSignedIn: signal(false),
            mountUserButton: vi.fn(),
            unmountUserButton: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [UserButtonComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(UserButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should not render user button container when not signed in', () => {
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
            isSignedIn: signal(false),
            mountUserButton: vi.fn(),
            unmountUserButton: vi.fn(),
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [UserButtonComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoContainer },
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
        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();
        let compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeNull();

        mockClerkService.isSignedIn.set(true);
        fixture.detectChanges();
        compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeTruthy();

        mockClerkService.isSignedIn.set(false);
        fixture.detectChanges();
        compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.user-button-container')).toBeNull();
    });
});
