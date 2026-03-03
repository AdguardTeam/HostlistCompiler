import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ValidationComponent } from './validation.component';
import { API_BASE_URL } from '../tokens';

describe('ValidationComponent', () => {
    let fixture: ComponentFixture<ValidationComponent>;
    let component: ValidationComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ValidationComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ValidationComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should start with empty rules text', () => {
        expect(component.rulesText()).toBe('');
    });

    it('should default strict mode to false', () => {
        expect(component.strictMode).toBe(false);
    });

    it('should start with rule count of 0', () => {
        expect(component.ruleCount()).toBe(0);
    });

    it('should parse rules from text and update count', () => {
        component.rulesText.set('||example.com^\n@@||trusted.com^\n');
        expect(component.ruleCount()).toBe(2);
    });

    it('should ignore comment lines (starting with !)', () => {
        component.rulesText.set('! This is a comment\n||example.com^\n! Another comment');
        expect(component.ruleCount()).toBe(1);
    });

    it('should ignore blank lines', () => {
        component.rulesText.set('||example.com^\n\n\n@@||trusted.com^');
        expect(component.ruleCount()).toBe(2);
    });

    it('should not trigger validation with empty text', () => {
        component.rulesText.set('');
        component.validate();
        expect(component.ruleCount()).toBe(0);
    });

    it('should not trigger validation with only comments', () => {
        component.rulesText.set('! only comments\n! nothing else');
        component.validate();
        expect(component.ruleCount()).toBe(0);
    });

    it('should render the page heading', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('h1')?.textContent).toContain('Filter Rule Validation');
    });
});
