import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AdminComponent } from './admin.component';

describe('AdminComponent', () => {
    let fixture: ComponentFixture<AdminComponent>;
    let component: AdminComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AdminComponent, NoopAnimationsModule],
            providers: [
                provideZonelessChangeDetection(),
                provideRouter([]),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AdminComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should expose navigation groups', () => {
        expect(component.navGroups.length).toBeGreaterThan(0);
        expect(component.navGroups[0].section).toBe('Overview');
    });

    it('should have all expected sections', () => {
        const sections = component.navGroups.map(g => g.section);
        expect(sections).toEqual([
            'Overview',
            'Identity & Access',
            'Configuration',
            'Monitoring',
            'System',
        ]);
    });

    it('should start with sidenav not collapsed', () => {
        expect(component.collapsed()).toBe(false);
    });

    it('should start with mobile sidenav closed', () => {
        expect(component.sidenavOpen()).toBe(false);
    });

    it('should render sidenav container', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('mat-sidenav-container')).toBeTruthy();
    });

    it('should render router-outlet for child panels', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('router-outlet')).toBeTruthy();
    });

    it('should render navigation items with data-permission attributes', async () => {
        await fixture.whenStable();
        const el: HTMLElement = fixture.nativeElement;
        const links = el.querySelectorAll('[data-permission]');
        expect(links.length).toBeGreaterThan(0);
    });

    it('should have a dashboard route in the first group', () => {
        const overviewItems = component.navGroups[0].items;
        expect(overviewItems.some(i => i.route === 'dashboard')).toBe(true);
    });

    it('should have a storage route in the System group', () => {
        const systemGroup = component.navGroups.find(g => g.section === 'System');
        expect(systemGroup).toBeTruthy();
        expect(systemGroup!.items.some(i => i.route === 'storage')).toBe(true);
    });
});
