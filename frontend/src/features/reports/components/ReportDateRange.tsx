import { type ChangeEvent } from 'react';
import { cn } from '../../../utils/cn';
import type { ReportsDateRange } from '../types/report.types';
import { formatDateForApi, formatDateForInput } from '../utils/reportUtils';

interface ReportDateRangeProps {
  dateRange: ReportsDateRange;
  onChange: (range: ReportsDateRange) => void;
  className?: string;
}

export function ReportDateRange({ dateRange, onChange, className }: ReportDateRangeProps) {
  const handleStartChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...dateRange, start: formatDateForApi(e.target.value) });
  };

  const handleEndChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...dateRange, end: formatDateForApi(e.target.value) });
  };

  return (
    <div className={cn('flex flex-wrap items-end gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="report-start" className="text-sm font-medium text-foreground">
          Start
        </label>
        <input
          id="report-start"
          type="datetime-local"
          value={formatDateForInput(dateRange.start)}
          onChange={handleStartChange}
          className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="report-end" className="text-sm font-medium text-foreground">
          End
        </label>
        <input
          id="report-end"
          type="datetime-local"
          value={formatDateForInput(dateRange.end)}
          onChange={handleEndChange}
          className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
