/**
 * IncidentPagination component.
 * 
 * Provides pagination controls for incident list.
 * Supports next/previous navigation and page display.
 */

import type { PaginationMeta } from '../types/incident.types';
import { Button } from '../../../components/ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface IncidentPaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function IncidentPagination({
  meta,
  onPageChange,
  isLoading = false,
  className = '',
}: IncidentPaginationProps) {
  const { page, total_pages, next, previous } = meta;

  const handlePrevious = () => {
    if (previous && page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (next && page < total_pages) {
      onPageChange(page + 1);
    }
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="text-sm text-muted-foreground">
        Page {page} of {total_pages} ({meta.count} total)
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!previous || isLoading || page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!next || isLoading || page >= total_pages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
