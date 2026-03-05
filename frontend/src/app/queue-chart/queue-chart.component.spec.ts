import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { QueueChartComponent } from './queue-chart.component';

describe('QueueChartComponent', () => {
    let component: QueueChartComponent;
    let fixture: ComponentFixture<QueueChartComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [QueueChartComponent],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();

        fixture = TestBed.createComponent(QueueChartComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have default dimensions', () => {
        expect(component.height()).toBe(180);
        expect(component.width()).toBe(400);
    });

    it('should have default color', () => {
        expect(component.color()).toContain('--app-primary');
    });

    it('should compute viewBox from dimensions', () => {
        expect(component.viewBox()).toBe('0 0 400 180');
    });

    it('should compute innerWidth', () => {
        expect(component.innerWidth()).toBe(400 - component.padding);
    });

    it('should return empty polylinePoints for empty data', () => {
        expect(component.polylinePoints()).toEqual([]);
    });

    it('should compute polylinePoints for data', () => {
        fixture.componentRef.setInput('dataPoints', [10, 20, 30]);
        const points = component.polylinePoints();
        expect(points.length).toBe(3);
        expect(points[0].value).toBe(10);
        expect(points[1].value).toBe(20);
        expect(points[2].value).toBe(30);
    });

    it('should scale Y values correctly', () => {
        fixture.componentRef.setInput('dataPoints', [0, 50, 100]);
        const points = component.polylinePoints();
        // Max value (100) should be at the top, 0 at the bottom
        expect(points[2].y).toBeLessThan(points[0].y);
    });

    it('should generate line points string', () => {
        fixture.componentRef.setInput('dataPoints', [10, 20]);
        const linePoints = component.linePoints();
        expect(linePoints).toContain(',');
        expect(linePoints.split(' ').length).toBe(2);
    });

    it('should generate area points for polygon', () => {
        fixture.componentRef.setInput('dataPoints', [10, 20, 30]);
        const area = component.areaPoints();
        expect(area).toBeTruthy();
        // Area should have more points than the line (includes baseline)
        expect(area.split(' ').length).toBeGreaterThan(3);
    });

    it('should return empty area for single point', () => {
        fixture.componentRef.setInput('dataPoints', [10]);
        expect(component.areaPoints()).toBe('');
    });

    it('should compute grid lines', () => {
        const gridLines = component.gridLines();
        expect(gridLines.length).toBe(5); // 4 divisions = 5 lines
    });

    it('should compute y-axis ticks', () => {
        fixture.componentRef.setInput('dataPoints', [0, 50, 100]);
        const ticks = component.yTicks();
        expect(ticks.length).toBe(5);
        expect(ticks[0].label).toBe('100'); // Top tick = max value
    });

    it('should handle single data point', () => {
        fixture.componentRef.setInput('dataPoints', [42]);
        const points = component.polylinePoints();
        expect(points.length).toBe(1);
        expect(points[0].value).toBe(42);
    });

    it('should render SVG element', () => {
        fixture.detectChanges();
        const svg = fixture.nativeElement.querySelector('svg');
        expect(svg).toBeTruthy();
    });

    it('should show empty label when no data', () => {
        fixture.detectChanges();
        const emptyLabel = fixture.nativeElement.querySelector('.empty-label');
        expect(emptyLabel).toBeTruthy();
        expect(emptyLabel.textContent).toContain('No data');
    });

    it('should render label when provided', () => {
        fixture.componentRef.setInput('label', 'Test Chart');
        fixture.detectChanges();
        const label = fixture.nativeElement.querySelector('.chart-label');
        expect(label).toBeTruthy();
        expect(label.textContent).toContain('Test Chart');
    });
});
