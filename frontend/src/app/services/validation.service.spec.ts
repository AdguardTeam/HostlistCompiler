import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ValidationService, ValidationResult } from './validation.service';
import { API_BASE_URL } from '../tokens';

describe('ValidationService', () => {
    let service: ValidationService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: API_BASE_URL, useValue: '/api' },
            ],
        });
        service = TestBed.inject(ValidationService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should POST rules to /api/validate', () => {
        const rules = ['||example.com^', '@@||trusted.com^'];
        const mockResult: ValidationResult = {
            success: true,
            valid: true,
            totalRules: 2,
            validRules: 2,
            invalidRules: 0,
            errors: [],
            warnings: [],
            duration: '5ms',
        };

        service.validate(rules).subscribe(result => {
            expect(result).toEqual(mockResult);
        });

        const req = httpTesting.expectOne('/api/validate');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ rules, strict: false });
        req.flush(mockResult);
    });

    it('should send strict mode when enabled', () => {
        service.validate(['||example.com^'], true).subscribe();

        const req = httpTesting.expectOne('/api/validate');
        expect(req.request.body.strict).toBe(true);
        req.flush({ success: true, valid: true, totalRules: 1, validRules: 1, invalidRules: 0, errors: [], warnings: [] });
    });

    it('should default strict to false', () => {
        service.validate(['||example.com^']).subscribe();

        const req = httpTesting.expectOne('/api/validate');
        expect(req.request.body.strict).toBe(false);
        req.flush({ success: true, valid: true, totalRules: 1, validRules: 1, invalidRules: 0, errors: [], warnings: [] });
    });

    it('should propagate HTTP errors', () => {
        let errorReceived = false;

        service.validate(['invalid']).subscribe({
            error: () => { errorReceived = true; },
        });

        const req = httpTesting.expectOne('/api/validate');
        req.error(new ProgressEvent('error'), { status: 500 });
        expect(errorReceived).toBe(true);
    });
});
