import { Select } from '../../../components/ui/Select';
import { ReportDateRange } from './ReportDateRange';
import { cn } from '../../../utils/cn';
import type { ReportsDateRange, TrendGranularity } from '../types/report.types';

interface ReportFiltersProps {
  dateRange: ReportsDateRange;
  granularity: TrendGranularity;
  onDateRangeChange: (range: ReportsDateRange) => void;
  onGranularityChange: (granularity: TrendGranularity) => void;
  className?: string;
}

const granularityOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export function ReportFilters({
  dateRange,
  granularity,
  onDateRangeChange,
  onGranularityChange,
  className,
}: ReportFiltersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <ReportDateRange dateRange={dateRange} onChange={onDateRangeChange} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="report-granularity" className="text-sm font-medium text-foreground">
          Granularity
        </label>
        <Select
          id="report-granularity"
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value as TrendGranularity)}
          options={granularityOptions}
          className="w-40"
        />
      </div>
    </div>
  );
}
