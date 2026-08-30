import type { ReportsDateRange } from '../types/report.types';

export function getDefaultDateRange(): ReportsDateRange {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    start: thirtyDaysAgo.toISOString().slice(0, 16),
    end: now.toISOString().slice(0, 16),
  };
}

export function formatDateForInput(isoString: string): string {
  return isoString.slice(0, 16);
}

export function formatDateForApi(inputValue: string): string {
  if (inputValue.endsWith('Z')) return inputValue;
  if (inputValue.length === 16) return `${inputValue}:00`;
  return inputValue;
}

