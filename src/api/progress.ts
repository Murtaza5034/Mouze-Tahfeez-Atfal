import { ProgressResult, calculateTakhteetProgress, getJuzStartPage, getJuzFromPage } from '../utils/progressCalculation';

// Mock database interfaces
export interface ChildProgress {
  child_id: string;
  current_juz: number;
  current_page: number; // 1 to 604
  target_juz: number;
  target_page: number; // 1 to 604
  target_surah: string;
}

export interface WeeklyProgressLog {
  id: string;
  child_id: string;
  date: string; // ISO date string
  pages_completed_this_week: number;
  progress_percent: number;
}

// Mock database functions (replace with actual database calls)
const mockChildProgress: Record<string, ChildProgress> = {};
const mockWeeklyProgressLog: WeeklyProgressLog[] = [];

export async function getChildProgress(childId: string): Promise<ChildProgress | null> {
  // In a real app, this would fetch from database
  return mockChildProgress[childId] || null;
}

export async function saveChildProgress(progress: ChildProgress): Promise<void> {
  // In a real app, this would save to database
  mockChildProgress[progress.child_id] = progress;
}

export async function saveWeeklyProgress(log: WeeklyProgressLog): Promise<void> {
  // In a real app, this would save to database
  mockWeeklyProgressLog.push(log);
}

export async function getWeeklyProgress(childId: string): Promise<WeeklyProgressLog[]> {
  // In a real app, this would fetch from database
  return mockWeeklyProgressLog.filter(log => log.child_id === childId);
}

// API endpoint to calculate progress
export async function calculateProgress(childId: string): Promise<ProgressResult & { childProgress: ChildProgress } | null> {
  const progress = await getChildProgress(childId);
  if (!progress) return null;
  
  const result = calculateTakhteetProgress(
    progress.current_page,
    progress.target_page,
    progress.current_juz
  );
  
  return {
    ...result,
    childProgress: progress
  };
}

// API endpoint to save weekly progress
export async function saveWeeklyProgressForChild(childId: string): Promise<void> {
  const progress = await getChildProgress(childId);
  if (!progress) return;
  
  const progressResult = await calculateProgress(childId);
  if (!progressResult) return;
  
  const log: WeeklyProgressLog = {
    id: `${childId}_${Date.now()}`,
    child_id: childId,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    pages_completed_this_week: Math.round((progressResult.progressPercent / 100) * (progress.target_page - getJuzStartPage(progress.current_juz) + 1)),
    progress_percent: progressResult.progressPercent
  };
  
  await saveWeeklyProgress(log);
}