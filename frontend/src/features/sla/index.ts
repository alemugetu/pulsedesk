/**
 * SLA feature exports.
 * 
 * Central export point for SLA and escalation components, hooks, services, and types.
 */

// Components
export { SlaStatusBadge } from './components/SlaStatusBadge';
export { SlaProgress } from './components/SlaProgress';
export { SlaSummaryCard } from './components/SlaSummaryCard';
export { SlaPolicyCard } from './components/SlaPolicyCard';
export { SlaPolicyList } from './components/SlaPolicyList';
export { SlaPolicyForm } from './components/SlaPolicyForm';
export { EscalationStatusBadge } from './components/EscalationStatusBadge';
export { EscalationLevelList } from './components/EscalationLevelList';
export { EscalationPolicyCard } from './components/EscalationPolicyCard';
export { EscalationPolicyList } from './components/EscalationPolicyList';
export { SlaEscalationSection } from './components/SlaEscalationSection';

// Hooks
export { useSlaPolicies, getSlaPoliciesQueryKey } from './hooks/useSlaPolicies';
export { useSlaPolicy, getSlaPolicyQueryKey } from './hooks/useSlaPolicy';
export { useIncidentSla, formatTimeRemaining } from './hooks/useIncidentSla';
export { useEscalationPolicies, getEscalationPoliciesQueryKey } from './hooks/useEscalationPolicies';
export { useEscalationPolicy, getEscalationPolicyQueryKey } from './hooks/useEscalationPolicy';

// Services
export {
  getSlaPolicies,
  getSlaPolicy,
  createSlaPolicy,
  updateSlaPolicy,
  getSlaTargets,
  getSlaTarget,
  createSlaTarget,
  updateSlaTarget,
} from './services/slaService';

export {
  getEscalationPolicies,
  getEscalationPolicy,
  createEscalationPolicy,
  updateEscalationPolicy,
  getEscalationLevels,
  getEscalationLevel,
  createEscalationLevel,
  updateEscalationLevel,
  getEscalationRules,
  createEscalationRule,
  getIncidentEscalations,
  evaluateIncidentEscalation,
} from './services/escalationService';

// Types
export type {
  SLAStatus,
  SLAState,
  IncidentPriority,
  SLATarget,
  SLAPolicy,
  IncidentSLASummary,
  SLAPolicyCreateRequest,
  SLAPolicyUpdateRequest,
  SLATargetCreateRequest,
  SLATargetUpdateRequest,
  SLAPolicyListResponse,
  SLATargetListResponse,
} from './types/sla.types';

export type {
  EscalationTargetType,
  EscalationTriggerType,
  EscalationStatus,
  EscalationEventStatus,
  EscalationLevel,
  EscalationRule,
  EscalationPolicy,
  EscalationEvent,
  IncidentEscalation,
  EscalationPolicyCreateRequest,
  EscalationPolicyUpdateRequest,
  EscalationLevelCreateRequest,
  EscalationLevelUpdateRequest,
  EscalationRuleCreateRequest,
  EscalationEvaluateRequest,
  EscalationPolicyListResponse,
  EscalationLevelListResponse,
  EscalationRuleListResponse,
  IncidentEscalationListResponse,
} from './types/escalation.types';
