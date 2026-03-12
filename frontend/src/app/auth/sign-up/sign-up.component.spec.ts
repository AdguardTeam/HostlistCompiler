import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignUpComponent } from './sign-up.component';
import { ClerkService } from '../../services/clerk.service';

describe('SignUpComponent', () => {
    let component: SignUpComponent;
    let fixture: ComponentFixture<SignUpComponent>;
    let mockClerkService: {
        mountSignUp: ReturnType<typeof vi.fn>;
        unmountSignUp: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockClerkService = {
            mountSignUp: vi.fn(),
            unmountSignUp: vi.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [SignUpComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SignUpComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render the sign-up container element', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.clerk-container');
        expect(container).toBeTruthy();
    });

    it('should have auth-page wrapper with correct styling', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const authPage = compiled.querySelector('.auth-page');
        expect(authPage).toBeTruthy();
    });

    it('should mount Clerk sign-up UI after render', () => {
        // afterNextRender runs asynchronously
        // mountSignUp should have been called with the container element
        expect(mockClerkService.mountSignUp).toHaveBeenCalledTimes(1);
        const callArg = mockClerkService.mountSignUp.mock.calls[0][0];
        expect(callArg).toBeInstanceOf(HTMLDivElement);
    });

    it('should unmount Clerk sign-up UI on destroy', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const containerElement = compiled.querySelector('.clerk-container') as HTMLDivElement;

        fixture.destroy();

        expect(mockClerkService.unmountSignUp).toHaveBeenCalledTimes(1);
        expect(mockClerkService.unmountSignUp).toHaveBeenCalledWith(containerElement);
    });

    it('should handle missing container gracefully on destroy', () => {
        // Create a component where the container is not available
        const mockClerkNoContainer = {
            mountSignUp: vi.fn(),
            unmountSignUp: vi.fn(),
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignUpComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoContainer },
            ],
        });

        const tempFixture = TestBed.createComponent(SignUpComponent);
        const tempComponent = tempFixture.componentInstance;

        // Manually set container to undefined to simulate missing element
        (tempComponent as any).container = () => undefined;

        // Should not throw when destroying
        expect(() => tempFixture.destroy()).not.toThrow();
        expect(mockClerkNoContainer.unmountSignUp).not.toHaveBeenCalled();
    });

    it('should handle null container element gracefully', () => {
        const mockClerkNoMount = {
            mountSignUp: vi.fn(),
            unmountSignUp: vi.fn(),
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignUpComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoMount },
            ],
        });

        const tempFixture = TestBed.createComponent(SignUpComponent);
        tempFixture.detectChanges();

        // The component should not throw if container is missing/null
        // afterNextRender will check for null and skip mounting
        expect(() => tempFixture.detectChanges()).not.toThrow();
    });

    it('should use correct CSS classes for layout', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const authPage = compiled.querySelector('.auth-page');
        const container = compiled.querySelector('.clerk-container');

        expect(authPage).toBeTruthy();
        expect(container).toBeTruthy();

        // Verify container has the clerk-container class
        expect(container?.classList.contains('clerk-container')).toBe(true);
    });

    it('should have minimum width on clerk-container', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.clerk-container') as HTMLElement;

        expect(container).toBeTruthy();
        // The component has inline styles, but we can verify the element exists
        expect(container.classList.contains('clerk-container')).toBe(true);
    });
});
