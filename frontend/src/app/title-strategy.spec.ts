import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AppTitleStrategy } from './title-strategy';

/** Minimal snapshot stub — `buildTitle` is spied on in each test. */
const STUB_SNAPSHOT = {} as RouterStateSnapshot;

describe('AppTitleStrategy', () => {
    let strategy: AppTitleStrategy;
    let titleService: Title;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([]),
                { provide: TitleStrategy, useClass: AppTitleStrategy },
            ],
        });
        strategy = TestBed.inject(TitleStrategy) as AppTitleStrategy;
        titleService = TestBed.inject(Title);
    });

    it('should set "PageName | Adblock Compiler" when route has a title', () => {
        vi.spyOn(strategy, 'buildTitle').mockReturnValue('Compiler');
        strategy.updateTitle(STUB_SNAPSHOT);
        expect(titleService.getTitle()).toBe('Compiler | Adblock Compiler');
    });

    it('should set "Adblock Compiler" when route has no title', () => {
        vi.spyOn(strategy, 'buildTitle').mockReturnValue(undefined);
        strategy.updateTitle(STUB_SNAPSHOT);
        expect(titleService.getTitle()).toBe('Adblock Compiler');
    });

    it('should set correct title for each named route', () => {
        const pages = ['Home', 'Compiler', 'Performance', 'Validation', 'API Reference', 'Admin'];
        for (const page of pages) {
            vi.spyOn(strategy, 'buildTitle').mockReturnValue(page);
            strategy.updateTitle(STUB_SNAPSHOT);
            expect(titleService.getTitle()).toBe(`${page} | Adblock Compiler`);
        }
    });
});
