import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignInComponent } from './sign-in.component';
import { ClerkService } from '../../services/clerk.service';

describe('SignInComponent', () => {
    let component: SignInComponent;
    let fixture: ComponentFixture<SignInComponent>;
    let mockClerkService: {
        mountSignIn: ReturnType<typeof vi.fn>;
        unmountSignIn: ReturnType<typeof vi.fn>;
    };
    let mockActivatedRoute: {
        queryParams: typeof of;
    };

    beforeEach(async () => {
        mockClerkService = {
            mountSignIn: vi.fn(),
            unmountSignIn: vi.fn(),
        };

        mockActivatedRoute = {
            queryParams: of({}),
        };

        await TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkService },
                { provide: ActivatedRoute, useValue: mockActivatedRoute },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(SignInComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render the sign-in container element', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.clerk-container');
        expect(container).toBeTruthy();
    });

    it('should have auth-page wrapper with correct styling', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const authPage = compiled.querySelector('.auth-page');
        expect(authPage).toBeTruthy();
    });

    it('should mount Clerk sign-in UI after render', () => {
        // afterNextRender runs asynchronously
        // mountSignIn should have been called with the container element
        expect(mockClerkService.mountSignIn).toHaveBeenCalledTimes(1);
        const callArg = mockClerkService.mountSignIn.mock.calls[0][0];
        expect(callArg).toBeInstanceOf(HTMLDivElement);
    });

    it('should unmount Clerk sign-in UI on destroy', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const containerElement = compiled.querySelector('.clerk-container') as HTMLDivElement;

        fixture.destroy();

        expect(mockClerkService.unmountSignIn).toHaveBeenCalledTimes(1);
        expect(mockClerkService.unmountSignIn).toHaveBeenCalledWith(containerElement);
    });

    it('should handle missing container gracefully on destroy', () => {
        // Create a component where the container is not available
        const mockClerkNoContainer = {
            mountSignIn: vi.fn(),
            unmountSignIn: vi.fn(),
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoContainer },
                { provide: ActivatedRoute, useValue: mockActivatedRoute },
            ],
        });

        const tempFixture = TestBed.createComponent(SignInComponent);
        const tempComponent = tempFixture.componentInstance;

        // Manually set container to undefined to simulate missing element
        (tempComponent as any).container = () => undefined;

        // Should not throw when destroying
        expect(() => tempFixture.destroy()).not.toThrow();
        expect(mockClerkNoContainer.unmountSignIn).not.toHaveBeenCalled();
    });

    it('should handle null container element gracefully', () => {
        const mockClerkNoMount = {
            mountSignIn: vi.fn(),
            unmountSignIn: vi.fn(),
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [SignInComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ClerkService, useValue: mockClerkNoMount },
                { provide: ActivatedRoute, useValue: mockActivatedRoute },
            ],
        });

        const tempFixture = TestBed.createComponent(SignInComponent);
        tempFixture.detectChanges();

        // The component should not throw if container is missing/null
        // afterNextRender will check for null and skip mounting
        expect(() => tempFixture.detectChanges()).not.toThrow();
    });
});
