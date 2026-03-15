import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ScopesComponent } from './scopes.component';

describe('ScopesComponent', () => {
    let fixture: ComponentFixture<ScopesComponent>;
    let component: ScopesComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ScopesComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ScopesComponent);
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
        expect(el.textContent).toContain('Scope Registry');
    });

    it('should start with empty scopes list', () => {
        expect(component.scopes().length).toBe(0);
    });
});
