/**
 * StatCardComponent — Zoneless Unit Tests
 *
 * Angular 21 testing patterns demonstrated:
 *
 * provideZonelessChangeDetection() in TestBed
 *   The test module mirrors the app's zoneless setup. Angular drives change
 *   detection via signal writes + microtask scheduler — no Zone.js patches.
 *
 * fixture.componentRef.setInput() — signal input setter
 *   The correct way to set signal inputs (`input()` / `input.required()`) in
 *   unit tests. Using `fixture.componentInstance.label = 'x'` does NOT work
 *   for signal inputs — you must use setInput().
 *
 * fixture.whenStable() for async change detection
 *   In zoneless mode, change detection is asynchronous (microtask-driven).
 *   await fixture.whenStable() flushes the scheduler so the template is
 *   updated before assertions run.
 *
 * Karma → Web Test Runner migration note
 *   This spec uses standard Jasmine + @angular/core/testing APIs and is
 *   compatible with both:
 *     - Web Test Runner (@web/test-runner) — Angular's recommended replacement for Karma
 *     - Jest (jest-preset-angular)
 *   To complete the migration, add one of these builders to angular.json:
 *     "test": { "builder": "@angular/build:web-test-runner", "options": {...} }
 *   See README.md for the full migration path.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { StatCardComponent } from './stat-card.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('StatCardComponent', () => {
    let fixture: ComponentFixture<StatCardComponent>;
    let component: StatCardComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                StatCardComponent,
                NoopAnimationsModule,
            ],
            providers: [
                // Zoneless change detection — mirrors the app's provideZonelessChangeDetection()
                // in app.config.ts. Tests run without Zone.js.
                provideZonelessChangeDetection(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(StatCardComponent);
        component = fixture.componentInstance;

        // Set required signal inputs using setInput() — the correct API for signal inputs.
        // (Assigning directly to component.label would NOT work for input() / input.required().)
        fixture.componentRef.setInput('label', 'Total Rules');
        fixture.componentRef.setInput('value', '456K');

        // Flush the zoneless change detection scheduler before asserting.
        await fixture.whenStable();
    });

    it('should render the label and value', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.stat-label')?.textContent?.trim()).toBe('Total Rules');
        expect(el.querySelector('.stat-value')?.textContent?.trim()).toBe('456K');
    });

    it('should use the default icon when icon input is not provided', () => {
        expect(component.icon()).toBe('info');
    });

    it('should override the icon via setInput()', async () => {
        fixture.componentRef.setInput('icon', 'filter_list');
        await fixture.whenStable();
        expect(component.icon()).toBe('filter_list');
    });

    it('should start with highlighted = false', () => {
        expect(component.highlighted()).toBe(false);
    });

    it('should toggle highlighted via model() when the card is clicked', async () => {
        const card = fixture.nativeElement.querySelector('.stat-card') as HTMLElement;
        card.click();
        await fixture.whenStable();
        // model() updated — highlighted should now be true
        expect(component.highlighted()).toBe(true);
    });

    it('should emit cardClicked with the label when clicked', async () => {
        let emittedLabel: string | undefined;
        // Subscribe to the output() via the OutputRef API
        component.cardClicked.subscribe((label: string) => {
            emittedLabel = label;
        });

        const card = fixture.nativeElement.querySelector('.stat-card') as HTMLElement;
        card.click();
        await fixture.whenStable();

        expect(emittedLabel).toBe('Total Rules');
    });

    it('should show the highlight badge when highlighted is true', async () => {
        fixture.componentRef.setInput('highlighted', true);
        await fixture.whenStable();
        const badge = fixture.nativeElement.querySelector('.highlight-badge');
        expect(badge).toBeTruthy();
    });

    it('should not show the highlight badge when highlighted is false', async () => {
        fixture.componentRef.setInput('highlighted', false);
        await fixture.whenStable();
        const badge = fixture.nativeElement.querySelector('.highlight-badge');
        expect(badge).toBeFalsy();
    });

    it('should update ariaLabel computed signal when label input changes', async () => {
        fixture.componentRef.setInput('label', 'Cache Hit Rate');
        fixture.componentRef.setInput('value', '89%');
        await fixture.whenStable();
        // computed() reads input() signals — should recalculate automatically
        expect(component.ariaLabel()).toBe('Stat card: Cache Hit Rate, value 89%');
    });
});
