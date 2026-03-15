import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { EndpointsComponent } from './endpoints.component';

describe('EndpointsComponent', () => {
    let fixture: ComponentFixture<EndpointsComponent>;
    let component: EndpointsComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [EndpointsComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(EndpointsComponent);
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
        expect(el.textContent).toContain('Endpoint Auth');
    });

    it('should start with empty endpoints', () => {
        expect(component.allEndpoints().length).toBe(0);
    });
});
