/**
 * Escalation types for PulseDesk.
 * 
 * TypeScript models matching the backend Escalation API contract.
 * Based on backend models and serializers in backend/apps/escalation/
 */

/**
 * Escalation target type enum matching backend EscalationTargetType
 */
export type EscalationTargetType = 'ASSIGNEE' | 'ROLE';

/**
 * Escalation trigger type enum matching backend EscalationTriggerType
 */
export type EscalationTriggerType = 'RESPONSE_BREACH' | 'RESOLUTION_BREACH';

/**
 * Escalation status enum matching backend EscalationStatus
 */
export type EscalationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/**
 * Escalation event status enum matching backend EscalationEventStatus
 */
export type EscalationEventStatus = 'EXECUTED';

/**
 * Escalation Level model - ordered escalation step within a policy
 */
export interface EscalationLevel {
  id: string;
  level: number;
  name: string;
  delay_minutes: number;
  target_type: EscalationTargetType;
  target_reference: string;
  created_at: string;
  updated_at: string;
}

/**
 * Escalation Rule model - maps trigger condition to escalation policy
 */
export interface EscalationRule {
  id: string;
  trigger_type: EscalationTriggerType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Escalation Policy model - organization-scoped named escalation policy
 */
export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  levels: EscalationLevel[];
  rules: EscalationRule[];
  created_at: string;
  updated_at: string;
}

/**
 * Escalation Event model - immutable historical record of escalation level execution
 */
export interface EscalationEvent {
  id: string;
  level: number;
  trigger_type: EscalationTriggerType;
  triggered_at: string;
  target_type: EscalationTargetType;
  target_reference: string;
  status: EscalationEventStatus;
}

/**
 * Incident Escalation model - per-incident escalation state tracking
 */
export interface IncidentEscalation {
  id: string;
  policy: string;
  trigger_type: EscalationTriggerType;
  current_level: number;
  status: EscalationStatus;
  started_at: string;
  last_evaluated_at: string | null;
  completed_at: string | null;
  events: EscalationEvent[];
}

/**
 * Escalation Policy create request
 */
export interface EscalationPolicyCreateRequest {
  name: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * Escalation Policy update request
 */
export interface EscalationPolicyUpdateRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * Escalation Level create request
 */
export interface EscalationLevelCreateRequest {
  level: number;
  name: string;
  delay_minutes?: number;
  target_type: EscalationTargetType;
  target_reference?: string;
}

/**
 * Escalation Level update request
 */
export interface EscalationLevelUpdateRequest {
  name?: string;
  delay_minutes?: number;
  target_type?: EscalationTargetType;
  target_reference?: string;
}

/**
 * Escalation Rule create request
 */
export interface EscalationRuleCreateRequest {
  trigger_type: EscalationTriggerType;
  is_active?: boolean;
}

/**
 * Escalation evaluate request
 */
export interface EscalationEvaluateRequest {
  trigger_type: EscalationTriggerType;
}

/**
 * Escalation Policy list response
 */
export interface EscalationPolicyListResponse {
  results: EscalationPolicy[];
}

/**
 * Escalation Level list response
 */
export interface EscalationLevelListResponse {
  results: EscalationLevel[];
}

/**
 * Escalation Rule list response
 */
export interface EscalationRuleListResponse {
  results: EscalationRule[];
}

/**
 * Incident Escalation list response
 */
export interface IncidentEscalationListResponse {
  results: IncidentEscalation[];
}
