/**
 * IncidentAssigneeModal component.
 *
 * Accessible modal dialog for assigning or reassigning an incident to an active
 * organization member or clearing assignment to the triage pool.
 *
 * Features:
 * - Scoped strictly to the active organization's members.
 * - Search filter for large teams.
 * - Human-readable presentation: names, emails, roles, and avatar initials (no raw UUIDs).
 * - Direct integration with useUpdateIncident TanStack Query mutation.
 * - Accessible focus handling, ARIA dialog attributes, and keyboard controls.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, UserCheck, UserX, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useOrganizationMembers } from '../../organizations/hooks/useOrganizationMembers';
import { useCurrentOrganization } from '../../organizations/context/organizationContextDef';
import { useUpdateIncident } from '../hooks/useUpdateIncident';
import type { Membership } from '../../organizations/types/membership';

interface IncidentAssigneeModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  currentAssigneeId?: string | null;
  onAssigned?: (assigneeId: string | null) => void;
}

function getMemberDisplayName(member: Membership): string {
  const { first_name, last_name, email } = member.user;
  const fullName = `${first_name || ''} ${last_name || ''}`.trim();
  return fullName || email.split('@')[0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface IncidentAssigneeDialogContentProps {
  onClose: () => void;
  incidentId: string;
  currentAssigneeId: string | null;
  onAssigned?: (assigneeId: string | null) => void;
}

function IncidentAssigneeDialogContent({
  onClose,
  incidentId,
  currentAssigneeId,
  onAssigned,
}: IncidentAssigneeDialogContentProps) {
  const organization = useCurrentOrganization();
  const organizationId = organization?.id ?? '';

  const { data: members = [], isLoading: isLoadingMembers, error: membersError } =
    useOrganizationMembers(organizationId);

  const { updateIncidentAsync, isLoading: isUpdating } = useUpdateIncident();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(
    currentAssigneeId
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isUpdating) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUpdating, onClose]);

  // Filter active organization members
  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status === 'ACTIVE');
  }, [members]);

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeMembers;
    return activeMembers.filter((m) => {
      const name = getMemberDisplayName(m).toLowerCase();
      const email = m.user.email.toLowerCase();
      const role = (m.role?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [activeMembers, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      await updateIncidentAsync({
        incidentId,
        data: {
          assignee_id: selectedMembershipId,
        },
      });
      onAssigned?.(selectedMembershipId);
      onClose();
    } catch (err) {
      console.error('Failed to update incident assignee:', err);
      const msg = err instanceof Error ? err.message : 'Failed to update assignment.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignee-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h2 id="assignee-modal-title" className="text-base font-semibold text-foreground">
              Assign Incident
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select an engineer or dispatcher from {organization?.name || 'organization'}.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isUpdating}
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-3">
            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or role..."
                disabled={isUpdating || isLoadingMembers}
                aria-label="Filter organization members"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
              />
            </div>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 divide-y divide-border/50">
            {isLoadingMembers && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mb-2 text-primary" />
                <span className="text-sm">Loading members...</span>
              </div>
            )}

            {membersError && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <AlertCircle className="h-6 w-6 text-destructive mb-1" />
                <p className="text-sm text-destructive font-medium">Failed to load members</p>
                <p className="text-xs text-muted-foreground mt-0.5">Please check your permissions.</p>
              </div>
            )}

            {!isLoadingMembers && !membersError && (
              <div className="space-y-1">
                {/* Unassigned Option */}
                <button
                  type="button"
                  onClick={() => setSelectedMembershipId(null)}
                  disabled={isUpdating}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors border ${
                    selectedMembershipId === null
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-transparent hover:bg-muted/60 text-muted-foreground'
                  }`}
                  aria-pressed={selectedMembershipId === null}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <UserX className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Unassigned (Triage Pool)</p>
                      <p className="text-xs text-muted-foreground">Return incident to organization pool</p>
                    </div>
                  </div>
                  {selectedMembershipId === null && (
                    <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  )}
                </button>

                {/* Filtered Members */}
                {filteredMembers.map((member) => {
                  const displayName = getMemberDisplayName(member);
                  const isSelected = selectedMembershipId === member.id;
                  const initials = getInitials(displayName);

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedMembershipId(member.id)}
                      disabled={isUpdating}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors border ${
                        isSelected
                          ? 'border-primary/40 bg-primary/5 text-foreground'
                          : 'border-transparent hover:bg-muted/60 text-foreground'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {displayName}
                            </p>
                            {member.role?.name && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                {member.role.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0 ml-2" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}

                {filteredMembers.length === 0 && searchQuery && (
                  <p className="text-center py-6 text-sm text-muted-foreground">
                    No active members found matching "{searchQuery}".
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border bg-muted/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUpdating || selectedMembershipId === currentAssigneeId}
              className="gap-1.5"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  Confirm Assignment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function IncidentAssigneeModal({
  isOpen,
  onClose,
  incidentId,
  currentAssigneeId = null,
  onAssigned,
}: IncidentAssigneeModalProps) {
  if (!isOpen) return null;

  return (
    <IncidentAssigneeDialogContent
      onClose={onClose}
      incidentId={incidentId}
      currentAssigneeId={currentAssigneeId ?? null}
      onAssigned={onAssigned}
    />
  );
}
