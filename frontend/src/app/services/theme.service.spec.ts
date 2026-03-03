import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, DOCUMENT } from '@angular/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
    let service: ThemeService;
    let doc: Document;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [provideZonelessChangeDetection()],
        });
        service = TestBed.inject(ThemeService);
        doc = TestBed.inject(DOCUMENT);
        // Ensure clean state
        doc.body.classList.remove('dark-theme');
    });

    afterEach(() => {
        localStorage.clear();
        doc.body.classList.remove('dark-theme');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should default to light mode', () => {
        expect(service.isDark()).toBe(false);
    });

    it('should toggle to dark mode', () => {
        service.toggle();
        expect(service.isDark()).toBe(true);
        expect(doc.body.classList.contains('dark-theme')).toBe(true);
    });

    it('should toggle back to light mode', () => {
        service.toggle(); // → dark
        service.toggle(); // → light
        expect(service.isDark()).toBe(false);
        expect(doc.body.classList.contains('dark-theme')).toBe(false);
    });

    it('should persist theme preference to localStorage', () => {
        service.toggle();
        expect(localStorage.getItem('theme')).toBe('dark');

        service.toggle();
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should load dark theme from localStorage', () => {
        localStorage.setItem('theme', 'dark');
        service.loadPreferences();
        expect(service.isDark()).toBe(true);
        expect(doc.body.classList.contains('dark-theme')).toBe(true);
    });

    it('should load light theme from localStorage', () => {
        localStorage.setItem('theme', 'light');
        service.loadPreferences();
        expect(service.isDark()).toBe(false);
        expect(doc.body.classList.contains('dark-theme')).toBe(false);
    });

    it('should default to light when localStorage is empty', () => {
        service.loadPreferences();
        expect(service.isDark()).toBe(false);
    });
});
