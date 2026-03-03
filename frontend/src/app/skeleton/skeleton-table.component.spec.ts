import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SkeletonTableComponent } from './skeleton-table.component';

describe('SkeletonTableComponent', () => {
    let fixture: ReturnType<typeof TestBed.createComponent<SkeletonTableComponent>>;
    let component: SkeletonTableComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SkeletonTableComponent],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();

        fixture = TestBed.createComponent(SkeletonTableComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render default 5 rows + 1 header', () => {
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll('.skeleton-row');
        expect(rows.length).toBe(6); // 1 header + 5 body
    });

    it('should render 4 columns by default', () => {
        fixture.detectChanges();
        const headerCells = fixture.nativeElement.querySelectorAll('.skeleton-row.header .skeleton-cell');
        expect(headerCells.length).toBe(4);
    });

    it('should compute row and column arrays', () => {
        expect(component.rowArray().length).toBe(5);
        expect(component.columnArray().length).toBe(4);
    });

    it('should return varying cell widths', () => {
        const w1 = component.getCellWidth(0, 0);
        const w2 = component.getCellWidth(1, 0);
        expect(w1).toBeDefined();
        expect(w2).toBeDefined();
    });
});
