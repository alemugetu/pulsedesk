import { FileText } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';

export function ReportsEmptyState() {
  return (
    <EmptyState
      title="No report data"
      description="There is no report data to display for this organization and date range."
      icon={<FileText className="h-12 w-12" aria-hidden="true" />}
    />
  );
}

