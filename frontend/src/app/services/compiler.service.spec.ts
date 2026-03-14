import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CompilerService, CompileResponse } from './compiler.service';
import { API_BASE_URL } from '../tokens';

describe('CompilerService', () => {
    let service: CompilerService;
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
        service = TestBed.inject(CompilerService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should POST to /api/compile with correct payload', () => {
        const urls = ['https://easylist.to/easylist/easylist.txt'];
        const transformations = ['RemoveComments', 'Deduplicate'];
        const mockResponse: CompileResponse = {
            success: true,
            rules: ['||example.com^'],
            ruleCount: 5000,
            compiledAt: '2024-01-01T00:00:00.000Z',
        };

        service.compile(urls, transformations).subscribe(result => {
            expect(result).toEqual(mockResponse);
        });

        const req = httpTesting.expectOne('/api/compile');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            configuration: {
                name: 'Adblock Compilation',
                sources: [{ source: 'https://easylist.to/easylist/easylist.txt' }],
                transformations: ['RemoveComments', 'Deduplicate'],
            },
            benchmark: true,
        });
        req.flush(mockResponse);
    });

    it('should include all expected transformations', () => {
        const transformations = service.getAvailableTransformations();
        expect(transformations).toContain('RemoveComments');
        expect(transformations).toContain('Deduplicate');
        expect(transformations).toContain('Validate');
        expect(transformations).toContain('TrimLines');
        expect(transformations).toContain('RemoveEmptyLines');
        expect(transformations).toContain('ConvertToAscii');
        expect(transformations.length).toBe(11);
    });

    it('should map multiple URLs to sources array', () => {
        const urls = ['https://a.com/1.txt', 'https://b.com/2.txt'];

        service.compile(urls, []).subscribe();

        const req = httpTesting.expectOne('/api/compile');
        expect(req.request.body.configuration.sources).toEqual([
            { source: 'https://a.com/1.txt' },
            { source: 'https://b.com/2.txt' },
        ]);
        req.flush({ success: true, ruleCount: 0, compiledAt: '2024-01-01T00:00:00.000Z' });
    });

    it('should POST to /api/compile/async with correct payload', () => {
        const urls = ['https://easylist.to/easylist/easylist.txt'];
        const transformations = ['RemoveComments'];
        const mockResponse = {
            success: true,
            note: 'Will process async',
            requestId: 'abc-123',
        };

        service.compileAsync(urls, transformations).subscribe(result => {
            expect(result).toEqual(mockResponse);
        });

        const req = httpTesting.expectOne('/api/compile/async');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            configuration: {
                name: 'Async Compilation',
                sources: [{ source: urls[0] }],
                transformations,
            },
            benchmark: true,
        });
        req.flush(mockResponse);
    });

    it('should POST to /api/compile/batch with correct payload', () => {
        const configurations = [{
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
            transformations: ['RemoveComments'],
        }];
        const mockResponse = {
            success: true,
            results: [{ id: 'batch-0', success: true, ruleCount: 100, compiledAt: '2024-01-01T00:00:00.000Z' }],
        };

        service.compileBatch(configurations).subscribe(result => {
            expect(result).toEqual(mockResponse.results);
        });

        const req = httpTesting.expectOne('/api/compile/batch');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            requests: [{
                id: 'batch-0',
                configuration: configurations[0],
                benchmark: true,
            }],
            turnstileToken: undefined,
        });
        req.flush(mockResponse);
    });
});
