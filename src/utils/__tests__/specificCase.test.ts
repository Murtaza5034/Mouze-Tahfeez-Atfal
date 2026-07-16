import { calculateTakhteetProgress } from '../progressCalculation';

describe('Specific case from user', () => {
  test('Juz 29, current page 566, target page 542 should show correct progress', () => {
    const result = calculateTakhteetProgress(566, 542, 29);
    console.log('Result for 566, 542, 29:', result);
    
    // For Juz 29 (Rule A): pages remaining = currentPage - targetPage
    // 566 - 542 = 24 pages remaining
    // Progress = 1 / (24 + 1) * 100 = 1/25 * 100 = 4%
    expect(result.pagesRemaining).toBe(24);
    expect(result.progressPercent).toBeCloseTo(4, 2); // 4%
  });
});