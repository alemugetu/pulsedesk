/**
 * AuditLogsPage — Audit & Operational History page.
 *
 * Responsibilities:
 * - Page title + description
 * - Permission-aware access (audit_log.view, backend is authoritative)
 * - Backend-supported filters
 * - Audit log list
 * - Backend-provided pagination
 * - Detail interaction (inline detail panel)
 * - Loading / error / empty states
 *
 * Page orchestration is kept separate from the feature components.
 */

import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { useCurrentOrganization } from '../../features/organizations/context/organizationContextDef';
import { AuditLogList } from '../../features/audit/components/AuditLogList';
import { AuditLogFilters } from '../../features/audit/components/AuditLogFilters';
import { AuditLogPagination } from '../../features/audit/components/AuditLogPagination';
import { AuditLogDetail } from '../../features/audit/components/AuditLogDetail';
import { useAuditLogs, useCanViewAuditLogs } from '../../features/audit/hooks/useAuditLogs';
import { useAuditLog } from '../../features/audit/hooks/useAuditLog';
import type { AuditLog, AuditLogFilters as AuditLogFilterValues } from '../../features/audit/types/audit.types';

const EMPTY_FILTERS: AuditLogFilterValues = {};

export function AuditLogsPage() {
  const organization = useCurrentOrganization();
  const canViewAuditLogs = useCanViewAuditLogs();

  const [filters, setFilters] = useState<AuditLogFilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const queryParams = useMemo(
    () => ({ ...filters, page }),
    [filters, page]
  );

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useAuditLogs(queryParams);

  const detailQuery = useAuditLog(
    selectedLogId && organization?.id ? selectedLogId : null
  );

  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;
  const detailErrorMessage = detailQuery.error
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : String(detailQuery.error)
    : null;

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => value !== undefined && value !== ''),
    [filters]
  );

  const handleFiltersChange = (next: AuditLogFilterValues) => {
    setFilters(next);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const handleSelectLog = (log: AuditLog) => {
    setSelectedLogId(log.id);
  };

  const handleCloseDetail = () => {
    setSelectedLogId(null);
  };

  if (!canViewAuditLogs) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="max-w-md p-6 text-center">
          <CardContent className="p-0">
            <ScrollText className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Access Restricted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You do not have permission to view audit logs. Contact your organization
              administrator for access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational and security history for your organization, newest first.
        </p>
      </div>

      <AuditLogFilters
        filters={filters}
        onChange={handleFiltersChange}
        onClear={handleClearFilters}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AuditLogList
            logs={data?.results ?? []}
            isLoading={isLoading}
            error={errorMessage}
            hasActiveFilters={hasActiveFilters}
            selectedLogId={selectedLogId}
            onSelect={handleSelectLog}
            onRetry={() => refetch()}
          />

          {data && !isLoading && (
            <AuditLogPagination
              count={data.count}
              next={data.next}
              previous={data.previous}
              currentPage={page}
              onPageChange={setPage}
              isLoading={isLoading}
              className="mt-4"
            />
          )}
        </div>

        <div className="lg:col-span-1">
          <AuditLogDetail
            log={detailQuery.data}
            isLoading={detailQuery.isLoading}
            error={detailErrorMessage}
            onRetry={() => detailQuery.refetch()}
            onClose={handleCloseDetail}
            className="lg:sticky lg:top-0"
          />
        </div>
      </div>
    </div>
  );
}