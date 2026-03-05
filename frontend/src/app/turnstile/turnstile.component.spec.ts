import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TurnstileComponent } from './turnstile.component';
import { TurnstileService } from '../services/turnstile.service';

describe('TurnstileComponent', () => {
    let component: TurnstileComponent;
    let fixture: ComponentFixture<TurnstileComponent>;
    let turnstileService: TurnstileService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TurnstileComponent],
            providers: [
                provideZonelessChangeDetection(),
                provideAnimationsAsync(),
                { provide: PLATFORM_ID, useValue: 'browser' },
            ],
        }).compileComponents();

        turnstileService = TestBed.inject(TurnstileService);
        fixture = TestBed.createComponent(TurnstileComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.componentRef.setInput('siteKey', 'test-key');
        expect(component).toBeTruthy();
    });

    it('should have required siteKey input', () => {
        fixture.componentRef.setInput('siteKey', 'my-site-key');
        expect(component.siteKey()).toBe('my-site-key');
    });

    it('should default theme to auto', () => {
        fixture.componentRef.setInput('siteKey', 'test-key');
        expect(component.theme()).toBe('auto');
    });

    it('should accept custom theme', () => {
        fixture.componentRef.setInput('siteKey', 'test-key');
        fixture.componentRef.setInput('theme', 'dark');
        expect(component.theme()).toBe('dark');
    });

    it('should render turnstile container element', () => {
        fixture.componentRef.setInput('siteKey', 'test-key');
        fixture.detectChanges();
        const container = fixture.nativeElement.querySelector('.turnstile-container');
        expect(container).toBeTruthy();
    });

    it('should render inside a mat-card', () => {
        fixture.componentRef.setInput('siteKey', 'test-key');
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');
        expect(card).toBeTruthy();
    });

    it('should call turnstileService.setSiteKey on render', () => {
        const spy = vi.spyOn(turnstileService, 'setSiteKey');
        fixture.componentRef.setInput('siteKey', 'my-key-123');
        fixture.detectChanges();
        // afterRenderEffect runs after render; trigger change detection
        TestBed.flushEffects();
        expect(spy).toHaveBeenCalledWith('my-key-123');
    });

    it('should call turnstileService.remove on destroy', () => {
        const spy = vi.spyOn(turnstileService, 'remove');
        fixture.componentRef.setInput('siteKey', 'test-key');
        fixture.detectChanges();
        fixture.destroy();
        expect(spy).toHaveBeenCalled();
    });
});
