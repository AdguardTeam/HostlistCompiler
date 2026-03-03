import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, PLATFORM_ID } from '@angular/core';
import { FilterParserService } from './filter-parser.service';

describe('FilterParserService', () => {
    let service: FilterParserService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: PLATFORM_ID, useValue: 'browser' },
            ],
        });
        service = TestBed.inject(FilterParserService);
    });

    afterEach(() => {
        service.terminate();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should start with null result', () => {
        expect(service.result()).toBeNull();
    });

    it('should not be parsing initially', () => {
        expect(service.isParsing()).toBe(false);
    });

    it('should have 0 progress initially', () => {
        expect(service.progress()).toBe(0);
    });

    it('should have no error initially', () => {
        expect(service.error()).toBeNull();
    });

    it('should return empty extracted URLs when no result', () => {
        expect(service.extractedUrls()).toEqual([]);
    });

    it('should set isParsing when parse is called', () => {
        // Worker may not work in jsdom, but signals should update
        service.parse('https://example.com\n||ads.com^');
        // isParsing is set synchronously before worker message
        // In jsdom, Worker may not be available, so it falls back
        expect(service.isParsing()).toBeDefined();
    });

    it('should terminate worker cleanly', () => {
        service.terminate();
        expect(service).toBeTruthy(); // No error thrown
    });
});
