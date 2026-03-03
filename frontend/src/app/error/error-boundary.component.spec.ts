import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ErrorHandler } from '@angular/core';
import { ErrorBoundaryComponent } from './error-boundary.component';
import { GlobalErrorHandler } from './global-error-handler';

describe('ErrorBoundaryComponent', () => {
    let fixture: ReturnType<typeof TestBed.createComponent<ErrorBoundaryComponent>>;
    let component: ErrorBoundaryComponent;
    let errorHandler: GlobalErrorHandler;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ErrorBoundaryComponent],
            providers: [
                provideZonelessChangeDetection(),
                { provide: ErrorHandler, useClass: GlobalErrorHandler },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ErrorBoundaryComponent);
        component = fixture.componentInstance;
        errorHandler = TestBed.inject(ErrorHandler) as GlobalErrorHandler;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should not show overlay when no error', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.error-boundary-overlay')).toBeNull();
    });

    it('should show overlay when error occurs', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        errorHandler.handleError(new Error('test error'));
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.error-boundary-overlay')).toBeTruthy();
        consoleSpy.mockRestore();
    });

    it('should dismiss error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        errorHandler.handleError(new Error('dismiss me'));
        fixture.detectChanges();

        component.dismiss();
        fixture.detectChanges();

        expect(errorHandler.hasError()).toBe(false);
        consoleSpy.mockRestore();
    });
});
