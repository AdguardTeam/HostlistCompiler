import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SkeletonCardComponent } from './skeleton-card.component';

describe('SkeletonCardComponent', () => {
    let fixture: ReturnType<typeof TestBed.createComponent<SkeletonCardComponent>>;
    let component: SkeletonCardComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SkeletonCardComponent],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();

        fixture = TestBed.createComponent(SkeletonCardComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render default 3 lines', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        const lines = el.querySelectorAll('[data-testid="skeleton-line"]');
        expect(lines.length).toBe(3);
    });

    it('should show avatar when showAvatar is true', async () => {
        fixture.componentRef.setInput('showAvatar', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('[data-testid="skeleton-avatar"]')).toBeTruthy();
    });

    it('should not show avatar by default', () => {
        fixture.detectChanges();
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('[data-testid="skeleton-avatar"]')).toBeNull();
    });

    it('should apply animate-pulse to lines', () => {
        fixture.detectChanges();
        const lines = fixture.nativeElement.querySelectorAll('[data-testid="skeleton-line"]');
        lines.forEach((line: HTMLElement) => {
            expect(line.classList.contains('animate-pulse')).toBe(true);
        });
    });
});
