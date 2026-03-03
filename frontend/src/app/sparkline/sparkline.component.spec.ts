import { SparklineComponent } from './sparkline.component';

describe('SparklineComponent', () => {
    describe('normalize', () => {
        it('should return empty array for empty input', () => {
            expect(SparklineComponent.normalize([])).toEqual([]);
        });

        it('should normalize data to [0,1] range', () => {
            const result = SparklineComponent.normalize([10, 20, 30]);
            expect(result[0]).toBeCloseTo(0);
            expect(result[1]).toBeCloseTo(0.5);
            expect(result[2]).toBeCloseTo(1);
        });

        it('should handle single value', () => {
            const result = SparklineComponent.normalize([5]);
            expect(result).toEqual([0]);
        });

        it('should handle equal values', () => {
            const result = SparklineComponent.normalize([5, 5, 5]);
            // All equal → range is 0, so division by 1 → all 0
            expect(result).toEqual([0, 0, 0]);
        });

        it('should handle negative values', () => {
            const result = SparklineComponent.normalize([-10, 0, 10]);
            expect(result[0]).toBeCloseTo(0);
            expect(result[1]).toBeCloseTo(0.5);
            expect(result[2]).toBeCloseTo(1);
        });
    });
});
