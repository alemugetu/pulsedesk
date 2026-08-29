/**
 * EscalationPolicyList component.
 * 
 * Displays real escalation policies from the API.
 * Supports loading, empty, error, and success states.
 */

import { useEscalationPolicies } from '../hooks/useEscalationPolicies';
import { EscalationPolicyCard } from './EscalationPolicyCard';
import { Loading } from '../../../components/ui/Loading';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';

interface EscalationPolicyListProps {
  isActive?: boolean;
  showLevels?: boolean;
  className?: string;
}

export function EscalationPolicyList({ isActive, showLevels = false, className = '' }: EscalationPolicyListProps) {
  const { data: policies, isLoading, error, refetch } = useEscalationPolicies(isActive);

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
          title="Failed to load escalation policies"
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
          title="No escalation policies found"
          description={isActive ? "No active escalation policies configured." : "No escalation policies configured."}
        />
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${className}`}>
      {policies.map((policy) => (
        <EscalationPolicyCard key={policy.id} policy={policy} showLevels={showLevels} />
      ))}
    </div>
  );
}
