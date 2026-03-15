import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FeatureFlagsComponent } from './feature-flags.component';

describe('FeatureFlagsComponent', () => {
    let fixture: ComponentFixture<FeatureFlagsComponent>;
    let component: FeatureFlagsComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FeatureFlagsComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(FeatureFlagsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render mat-card', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('mat-card')).toBeTruthy();
    });

    it('should render panel title', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.textContent).toContain('Feature Flags');
    });

    it('should start with empty flags', () => {
        expect(component.flags().length).toBe(0);
    });
});
