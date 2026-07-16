import { calculateTakhteetProgress, getJuzStartPage } from '../progressCalculation';

describe('getJuzStartPage', () => {
  test('returns correct values for known points', () => {
    expect(getJuzStartPage(1)).toBe(1);
    expect(getJuzStartPage(30)).toBe(582);
  });

  test('handles edge cases', () => {
    expect(getJuzStartPage(0)).toBe(1); // clamped to 1
    expect(getJuzStartPage(31)).toBe(582); // clamped to 30
  });
});

describe('calculateTakhteetProgress', () => {
  describe('Rule A (Juz 26-30)', () => {
    test('matches the provided example for Juz 29', () => {
      const result = calculateTakhteetProgress(585, 583, 29);
      expect(result.pagesRemaining).toBe(2);
      expect(result.progressPercent).toBeCloseTo(33.33, 2);
    });

    test('handles case where current equals target', () => {
      const result = calculateTakhteetProgress(585, 585, 29);
      expect(result.pagesRemaining).toBe(0);
      expect(result.progressPercent).toBe(100);
    });

    test('handles case where target is beyond current (should not happen in practice)', () => {
      const result = calculateTakhteetProgress(583, 585, 29);
      expect(result.pagesRemaining).toBe(0); // max(0, negative) = 0
      expect(result.progressPercent).toBe(100);
    });
  });

  describe('Rule B (Juz 1-25)', () => {
    test('matches the provided example for Juz 3', () => {
      const result = calculateTakhteetProgress(61, 101, 3);
      expect(result.pagesRemaining).toBe(40);
      expect(result.progressPercent).toBeCloseTo(60.39, 2);
    });

    test('handles case where current equals target', () => {
      const result = calculateTakhteetProgress(61, 61, 3);
      expect(result.pagesRemaining).toBe(0);
      expect(result.progressPercent).toBe(100);
    });

    test('handles case where target is before current (should not happen in practice)', () => {
      const result = calculateTakhteetProgress(101, 61, 3);
      expect(result.pagesRemaining).toBe(0); // max(0, negative) = 0
      expect(result.progressPercent).toBe(100);
    });
  });

  test('works for boundary between rule sets', () => {
    // Test Juz 25 (should use Rule B)
    const result25 = calculateTakhteetProgress(100, 150, 25);
    expect(result25.pagesRemaining).toBe(50);
    
    // Test Juz 26 (should use Rule A)
    const result26 = calculateTakhteetProgress(500, 450, 26);
    expect(result26.pagesRemaining).toBe(50);
  });
});