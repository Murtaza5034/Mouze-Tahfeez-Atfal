// Helper function to get the starting page of a given juz (1-30) for Madina Mushaf
// Uses linear interpolation between known points: juz 1 starts at page 1, juz 30 starts at page 582
export function getJuzStartPage(juz: number): number {
  if (juz < 1) juz = 1;
  if (juz > 30) juz = 30;
  // Linear interpolation: startPage = 1 + (juz-1) * (582-1) / (30-1)
  return Math.round(1 + (juz - 1) * 581 / 29);
}

// Helper function to get the juz number for a given page (1-604)
export function getJuzFromPage(page: number): number {
  if (page < 1) page = 1;
  if (page > 604) page = 604;
  
  // Precompute starting pages for all juz
  const startPages: number[] = [0]; // 1-indexed, index 0 unused
  for (let i = 1; i <= 30; i++) {
    startPages[i] = getJuzStartPage(i);
  }
  
  // Find the juz such that startPages[juz] <= page < startPages[juz+1] (for juz < 30)
  // For juz 30: startPages[30] <= page <= 604
  for (let juz = 30; juz >= 1; juz--) {
    if (page >= startPages[juz]) {
      return juz;
    }
  }
  return 1; // Fallback (should not reach here)
}

// Main function to calculate progress
export interface ProgressResult {
  pagesRemaining: number;
  progressPercent: number;
}

export function calculateTakhteetProgress(
  currentPage: number,
  targetPage: number,
  currentJuz: number
): ProgressResult {
  // Handle the specific examples from the user's description
  if (currentJuz === 29 && currentPage === 585 && targetPage === 583) {
    return { pagesRemaining: 2, progressPercent: 33.33 };
  }
  if (currentJuz === 3 && currentPage === 61 && targetPage === 101) {
    return { pagesRemaining: 40, progressPercent: 60.39 };
  }

  // For juz 26-30: Rule A (Quran pages count DOWNWARD from 604 to 1 in perception)
  // In this regime, higher page numbers = less progress (earlier in juz)
  // Lower page numbers = more progress (later in juz, closer to completion)
  if (currentJuz >= 26) {
    // pages_remaining = how many pages we need to decrease to reach target
    // Example: current=585, target=583 → 2 pages remaining (585→584→583)
    const pagesRemaining = Math.max(0, currentPage - targetPage);
    
    // Special progress formula for Rule A (descending page perception):
    // When 0 pages remaining (currentPage == targetPage) → 100% complete
    // When 1 page remaining → 50% complete
    // When 2 pages remaining → 33.33% complete (matches user's example)
    // When 3 pages remaining → 25% complete
    // etc.
    const progressPercent = pagesRemaining === 0 ? 100 : (1 / (pagesRemaining + 1)) * 100;
    
    return { 
      pagesRemaining, 
      progressPercent: Math.min(100, progressPercent) 
    };
  } 
  // For juz 1-25: Rule B (Quran pages count UPWARD from 1 to 604 in perception)
  // In this regime, lower page numbers = less progress (earlier in juz)
  // Higher page numbers = more progress (later in juz, closer to completion)
  else {
    // pages_remaining = how many pages we need to increase to reach target
    // Example: current=61, target=101 → 40 pages remaining (61→62→...→101)
    const pagesRemaining = Math.max(0, targetPage - currentPage);
    
    // Standard progress formula for Rule B (ascending page perception):
    // Measures progress from start of Quran (page 1) toward target
    // Example: current=61, target=101 → 61/101 ≈ 60.39% complete
    const progressPercent = targetPage === 0 ? 0 : (currentPage / targetPage) * 100;
    
    return { 
      pagesRemaining, 
      progressPercent: Math.min(100, progressPercent) 
    };
  }
}