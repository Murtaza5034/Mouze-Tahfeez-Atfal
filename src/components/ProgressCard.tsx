import React, { useEffect, useState } from 'react';
import { calculateProgress, saveWeeklyProgressForChild } from '../api/progress';

interface ProgressCardProps {
  childId: string;
  /** Optional: if true, show more detailed info for teachers */
  isTeacherView?: boolean;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ childId, isTeacherView = false }) => {
  const [progressData, setProgressData] = useState<{
    pagesRemaining: number;
    progressPercent: number;
    currentJuz: number;
    currentPage: number;
    targetJuz: number;
    targetPage: number;
    targetSurah: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await calculateProgress(childId);
        if (!result) {
          setError('Child progress not found');
          return;
        }
        const { childProgress, ...resultData } = result;
        setProgressData({
          ...resultData,
          currentJuz: childProgress.current_juz,
          currentPage: childProgress.current_page,
          targetJuz: childProgress.target_juz,
          targetPage: childProgress.target_page,
          targetSurah: childProgress.target_surah,
        });
      } catch (err) {
        setError('Failed to load progress data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [childId]);

  const handleSaveWeeklyProgress = async () => {
    // We need the current progress to get the child_id for saving weekly progress
    // But we don't have it stored in state separately, so we'll fetch it again or use progressData?
    // However, progressData doesn't have child_id, so we need to fetch the child progress to get the id.
    // Alternatively, we can store the child progress in state as well.
    // Let's refetch the child progress to get the id, then save weekly progress, then refetch the progress data.
    try {
      // First, get the current child progress to have the child_id
      const childProgressResult = await calculateProgress(childId);
      if (!childProgressResult) {
        throw new Error('Child progress not found');
      }
      const { childProgress } = childProgressResult;
      
      // Save the weekly progress
      await saveWeeklyProgressForChild(childProgress.child_id);
      
      // After saving, refetch the progress data to get any updates
      const updatedResult = await calculateProgress(childId);
      if (!updatedResult) {
        throw new Error('Child progress not found after save');
      }
      const { childProgress: updatedChildProgress, ...updatedResultData } = updatedResult;
      setProgressData({
        ...updatedResultData,
        currentJuz: updatedChildProgress.current_juz,
        currentPage: updatedChildProgress.current_page,
        targetJuz: updatedChildProgress.target_juz,
        targetPage: updatedChildProgress.target_page,
        targetSurah: updatedChildProgress.target_surah,
      });
      
      alert('Weekly progress saved successfully!');
    } catch (err) {
      alert('Failed to save weekly progress');
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!progressData) return <div className="p-4">No data available</div>;

  const {
    pagesRemaining,
    progressPercent,
    currentJuz,
    currentPage,
    targetJuz,
    targetPage,
    targetSurah,
  } = progressData;

  // Determine remaining Juz based on current and target
  const remainingJuz = targetJuz - currentJuz;
  const remainingJuzText = remainingJuz > 0 ? `${remainingJuz} Juz` : 'Completed';

  // Determine status
  const status = progressPercent >= 100 ? 'Target Completed' : '';

  // Format current and target display
  const getJuzSurahInfo = (juz: number, page: number) => {
    // We don't have a direct mapping from page to surah in this example
    // In a real app, you might have a mapping or compute it from juz and page within juz
    return `Juz ${juz}, Page ${page}`;
  };

  return (
    <div className="border rounded-lg p-4 shadow-md w-full max-w-xs">
      <div className="mb-2">
        <span className="font-medium text-gray-700">Current Wusool:</span>
        <span className="ml-2">{getJuzSurahInfo(currentJuz, currentPage)}</span>
      </div>
      <div className="mb-2">
        <span className="font-medium text-gray-700">Target Till:</span>
        <span className="ml-2">{getJuzSurahInfo(targetJuz, targetPage)} ({targetSurah})</span>
      </div>
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`bg-blue-600 h-2.5 rounded-full transition-width duration-500`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{progressPercent.toFixed(1)}%</span>
          <span>{status}</span>
        </div>
      </div>
      <div className="mb-2 text-sm text-gray-600">
        {pagesRemaining} pages / {remainingJuzText} remaining to complete target
      </div>
      {isTeacherView && (
        <div className="text-sm text-gray-500">
          <div>Target Surah: {targetSurah}</div>
          <div>Target Juz: {targetJuz}</div>
          <div>Target Page: {targetPage}</div>
        </div>
      )}
      <div className="mt-4">
        <button 
          onClick={handleSaveWeeklyProgress}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Save Weekly Progress
        </button>
      </div>
    </div>
  );
};

export default ProgressCard;