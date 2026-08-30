/**
 * AuditLogPagination — pagination controls for the audit log list.
 *
 * Matches the backend DRF PageNumberPagination contract:
 *   { count, next, previous, results } + `page` query parameter.
 *
 * The backend page size is fixed (PAGE_SIZE=50), so the total page count is
 * derived from `count`. `next`/`previous` are authoritative for whether a
 * next/previous page exists — fake pagination is never rendered.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { AUDIT_LOG_PAGE_SIZE } from '../types/audit.types';

interface AuditLogPaginationProps {
  count: number;
  next: string | null;
  previous: string | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function AuditLogPagination({
  count,
  next,
  previous,
  currentPage,
  onPageChange,
  isLoading = false,
  className = '',
}: AuditLogPaginationProps) {
  const hasResults = count > 0;
  const totalPages = hasResults ? Math.ceil(count / AUDIT_LOG_PAGE_SIZE) : 1;

  const handlePrevious = () => {
    if (previous && currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (next && currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm text-muted-foreground">
        {hasResults ? (
          <>
            <span aria-label={`${count} total audit records`}>{count} records</span>
            {' · '}Page {currentPage} of {totalPages}
          </>
        ) : (
          'No records'
        )}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!previous || isLoading || currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!next || isLoading || currentPage >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}