/**
 * SlaPolicyList component.
 * 
 * Displays real SLA policies from the API.
 * Supports loading, empty, error, and success states.
 */

import { useSlaPolicies } from '../hooks/useSlaPolicies';
import { SlaPolicyCard } from './SlaPolicyCard';
import { Loading } from '../../../components/ui/Loading';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';

interface SlaPolicyListProps {
  isActive?: boolean;
  className?: string;
}

export function SlaPolicyList({ isActive, className = '' }: SlaPolicyListProps) {
  const { data: policies, isLoading, error, refetch } = useSlaPolicies(isActive);

  if (isLoading) {
    return (
      <div className={`flex justify-center py-12 ${className}`}>
        <Loading size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`py-12 ${className}`}>
        <ErrorState
          title="Failed to load SLA policies"
          description={error instanceof Error ? error.message : 'An error occurred'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!policies || policies.length === 0) {
    return (
      <div className={`py-12 ${className}`}>
        <EmptyState
          title="No SLA policies found"
          description={isActive ? "No active SLA policies configured." : "No SLA policies configured."}
        />
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${className}`}>
      {policies.map((policy) => (
        <SlaPolicyCard key={policy.id} policy={policy} />
      ))}
    </div>
  );
}
