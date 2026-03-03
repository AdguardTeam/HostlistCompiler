import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { ThemeService } from './services/theme.service';

describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let component: AppComponent;
    let themeService: ThemeService;

    beforeEach(async () => {
        localStorage.clear();
        await TestBed.configureTestingModule({
            imports: [AppComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([]),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AppComponent);
        component = fixture.componentInstance;
        themeService = TestBed.inject(ThemeService);
        await fixture.whenStable();
    });

    afterEach(() => localStorage.clear());

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have 6 navigation items', () => {
        expect(component.navItems.length).toBe(6);
    });

    it('should include Home nav item', () => {
        const home = component.navItems.find(i => i.path === '/');
        expect(home).toBeTruthy();
        expect(home!.label).toBe('Home');
        expect(home!.icon).toBe('home');
    });

    it('should include Compiler nav item', () => {
        const compiler = component.navItems.find(i => i.path === '/compiler');
        expect(compiler).toBeTruthy();
        expect(compiler!.label).toBe('Compiler');
    });

    it('should include Admin nav item', () => {
        const admin = component.navItems.find(i => i.path === '/admin');
        expect(admin).toBeTruthy();
        expect(admin!.label).toBe('Admin');
    });

    it('should start with sidenav open on desktop', () => {
        expect(component.sidenavOpen()).toBe(true);
    });

    it('should toggle sidenav', () => {
        expect(component.sidenavOpen()).toBe(true);
        component.toggleSidenav();
        expect(component.sidenavOpen()).toBe(false);
        component.toggleSidenav();
        expect(component.sidenavOpen()).toBe(true);
    });

    it('should default isMobile to false', () => {
        // In jsdom, BreakpointObserver resolves to non-mobile
        expect(component.isMobile()).toBe(false);
    });

    it('should expose theme service', () => {
        expect(component.themeService).toBeTruthy();
        expect(component.themeService.isDark()).toBe(false);
    });

    it('should return route animation data', () => {
        // Without navigation, returns empty or default
        const data = component.getRouteAnimationData();
        expect(typeof data).toBe('string');
    });

    it('should render the toolbar title', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.toolbar-title')?.textContent).toContain('Adblock Compiler');
    });

    it('should render the main content area with role=main', async () => {
        await fixture.whenStable();
        const main = fixture.nativeElement.querySelector('[role="main"]');
        expect(main).toBeTruthy();
        expect(main.getAttribute('aria-label')).toBe('Main content');
    });

    it('should render menu button with aria-label', async () => {
        await fixture.whenStable();
        const menuBtn = fixture.nativeElement.querySelector('button[aria-label="Toggle navigation"]');
        expect(menuBtn).toBeTruthy();
    });
});
