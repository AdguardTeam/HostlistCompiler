import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CompilerComponent } from './compiler.component';
import { API_BASE_URL } from '../tokens';

describe('CompilerComponent', () => {
    let fixture: ComponentFixture<CompilerComponent>;
    let component: CompilerComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CompilerComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideRouter([]),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CompilerComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have 3 presets', () => {
        expect(component.presets.length).toBe(3);
    });

    it('should default to first preset', () => {
        expect(component.selectedPreset()).toBe('DNS Blocking (EasyList)');
    });

    it('should initialize form with preset URLs', () => {
        expect(component.urlsArray.length).toBe(1);
        expect(component.urlsArray.at(0).value).toBe('https://easylist.to/easylist/easylist.txt');
    });

    it('should add a URL field', () => {
        const initialCount = component.urlsArray.length;
        component.addUrl();
        expect(component.urlsArray.length).toBe(initialCount + 1);
    });

    it('should remove a URL field when more than one exists', () => {
        component.addUrl(); // Now 2
        expect(component.urlsArray.length).toBe(2);
        component.removeUrl(1);
        expect(component.urlsArray.length).toBe(1);
    });

    it('should not remove the last URL field', () => {
        expect(component.urlsArray.length).toBe(1);
        component.removeUrl(0);
        expect(component.urlsArray.length).toBe(1);
    });

    it('should apply preset and reset form URLs', () => {
        component.applyPreset('Privacy (EasyPrivacy)');
        expect(component.selectedPreset()).toBe('Privacy (EasyPrivacy)');
        expect(component.urlsArray.at(0).value).toBe('https://easylist.to/easylist/easyprivacy.txt');
    });

    it('should update linkedSignal when preset changes', () => {
        component.applyPreset('Custom (Empty)');
        expect(component.presetUrls()).toEqual(['']);
    });

    it('should default compilation mode to json', () => {
        expect(component.compilationMode()).toBe('json');
    });

    it('should set compilation mode', () => {
        component.compilationMode.set('async');
        expect(component.compilationMode()).toBe('async');
    });

    it('should have drag over state default to false', () => {
        expect(component.dragOver()).toBe(false);
    });

    it('should set dragOver on drag events', () => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as DragEvent;
        component.onDragOver(mockEvent);
        expect(component.dragOver()).toBe(true);

        component.onDragLeave();
        expect(component.dragOver()).toBe(false);
    });

    it('should not submit when form is invalid', () => {
        component.urlsArray.at(0).setValue('');
        component.onSubmit();
        // compileResource should still be idle
        expect(component.compileResource.status()).toBe('idle');
    });

    it('should navigate home when goHome is called', () => {
        const router = TestBed.inject(Router);
        const navigateSpy = vi.spyOn(router, 'navigate');
        component.goHome();
        expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });

    it('should list all available transformations', () => {
        expect(component.availableTransformations.length).toBeGreaterThan(0);
        expect(component.availableTransformations).toContain('RemoveComments');
    });

    it('should compute isCompiling as false initially', () => {
        expect(component.isCompiling()).toBe(false);
    });

    it('should render the page heading', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('h1')?.textContent).toContain('Compiler');
    });
});
