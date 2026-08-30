/**
 * Tests for AuditLog UI components.
 *
 * Covers record rendering (actor/action/resource/changes), state handling
 * (loading/error/empty/detail), filters, and pagination boundaries.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditLogItem } from '../components/AuditLogItem';
import { AuditLogList } from '../components/AuditLogList';
import { AuditLogDetail } from '../components/AuditLogDetail';
import { AuditLogPagination } from '../components/AuditLogPagination';
import { AuditLogEmptyState } from '../components/AuditLogEmptyState';
import { AuditLogFilters } from '../components/AuditLogFilters';

const actorLog = {
  id: 'log-1',
  organization: 'org-123',
  actor: { id: 'user-1', email: 'ana@b.com', first_name: 'Ana', last_name: 'Doe' },
  action: 'incident.created' as const,
  resource_type: 'incident',
  resource_id: 'inc-42',
  changes: { status: 'OPEN' },
  ip_address: '10.0.0.1',
  created_at: '2026-08-01T10:00:00Z',
};

const systemLog = {
  ...actorLog,
  id: 'log-2',
  actor: null,
  action: 'sla.breached' as const,
  changes: { sla_policy_name: 'Gold' },
  ip_address: null,
  created_at: '2026-08-02T11:00:00Z',
};

const noop = () => {};

describe('AuditLogItem', () => {
  it('renders action label, actor, resource, and timestamp', () => {
    render(<AuditLogItem log={actorLog} onClick={noop} />);
    expect(screen.getByText('Incident Created')).toBeInTheDocument();
    expect(screen.getByText('Ana Doe')).toBeInTheDocument();
    expect(screen.getByText('Incident')).toBeInTheDocument();
    expect(screen.getByText(/inc-42/)).toBeInTheDocument();
    expect(screen.getByText('status: OPEN')).toBeInTheDocument();
  });

  it('marks system events explicitly', () => {
    render(<AuditLogItem log={systemLog} onClick={noop} />);
    expect(screen.getByText('SLA Breached')).toBeInTheDocument();
    expect(screen.getByText('System-generated event')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<AuditLogItem log={actorLog} onClick={onClick} />);
    fireEvent.click(screen.getByLabelText('View audit log: Incident Created'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('AuditLogList', () => {
  it('renders loading skeleton when loading', () => {
    const { container } = render(
      <AuditLogList logs={[]} isLoading error={null} onSelect={noop} onRetry={noop} />
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Loading audit logs')).toBeInTheDocument();
  });

  it('renders error state with retry', () => {
    const onRetry = vi.fn();
    render(
      <AuditLogList logs={[]} isLoading={false} error="Boom" onSelect={noop} onRetry={onRetry} />
    );
    expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the no-filters empty state', () => {
    render(
      <AuditLogList logs={[]} isLoading={false} error={null} onSelect={noop} onRetry={noop} />
    );
    expect(screen.getByText('No audit records yet')).toBeInTheDocument();
  });

  it('renders the filtered empty state when filters are active', () => {
    render(
      <AuditLogList
        logs={[]}
        isLoading={false}
        error={null}
        hasActiveFilters
        onSelect={noop}
        onRetry={noop}
      />
    );
    expect(screen.getByText('No matching audit records')).toBeInTheDocument();
  });

  it('renders records when data is present', () => {
    render(
      <AuditLogList
        logs={[actorLog, systemLog]}
        isLoading={false}
        error={null}
        onSelect={noop}
        onRetry={noop}
      />
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Incident Created')).toBeInTheDocument();
    expect(screen.getByText('SLA Breached')).toBeInTheDocument();
  });
});

describe('AuditLogDetail', () => {
  it('shows the selection placeholder when nothing is selected', () => {
    render(
      <AuditLogDetail log={undefined} isLoading={false} error={null} onRetry={noop} onClose={noop} />
    );
    expect(screen.getByText(/Select an audit record to view its full details/)).toBeInTheDocument();
  });

  it('shows the loading indicator while fetching a record', () => {
    render(<AuditLogDetail log={undefined} isLoading error={null} onRetry={noop} onClose={noop} />);
    expect(screen.getByText('Loading audit record...')).toBeInTheDocument();
  });

  it('shows error and retries', () => {
    const onRetry = vi.fn();
    render(
      <AuditLogDetail log={undefined} isLoading={false} error="Detail boom" onRetry={onRetry} onClose={noop} />
    );
    expect(screen.getByText('Failed to load audit record')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders every backend field for an actor record', () => {
    render(<AuditLogDetail log={actorLog} isLoading={false} error={null} onRetry={noop} onClose={noop} />);
    expect(screen.getByText('Performed by')).toBeInTheDocument();
    expect(screen.getByText('(ana@b.com)')).toBeInTheDocument();
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();
    expect(screen.getByText('IP address')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('org-123')).toBeInTheDocument();
    expect(screen.getByText('Record ID')).toBeInTheDocument();
    expect(screen.getByText('log-1')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText(/"status": "OPEN"/)).toBeInTheDocument();
  });

  it('renders the system label and null IP for system events', () => {
    render(<AuditLogDetail log={systemLog} isLoading={false} error={null} onRetry={noop} onClose={noop} />);
    expect(screen.getByText('System (automated)')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('renders the no-changes message when changes are empty', () => {
    render(
      <AuditLogDetail
        log={{ ...actorLog, changes: {} }}
        isLoading={false}
        error={null}
        onRetry={noop}
        onClose={noop}
      />
    );
    expect(screen.getByText('No change metadata recorded.')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AuditLogDetail log={actorLog} isLoading={false} error={null} onRetry={noop} onClose={onClose} />
    );
    fireEvent.click(screen.getByLabelText('Close audit record details'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AuditLogPagination', () => {
  it('disables both buttons when there is no next/previous', () => {
    render(
      <AuditLogPagination
        count={3}
        next={null}
        previous={null}
        currentPage={1}
        onPageChange={noop}
      />
    );
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('renders derived page count from backend count', () => {
    render(
      <AuditLogPagination
        count={120}
        next="2"
        previous={null}
        currentPage={1}
        onPageChange={noop}
      />
    );
    expect(screen.getByLabelText('120 total audit records')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('navigates next and previous when available', () => {
    const onPageChange = vi.fn();
    render(
      <AuditLogPagination
        count={120}
        next="3"
        previous="1"
        currentPage={2}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});

describe('AuditLogEmptyState', () => {
  it('renders the default variant', () => {
    render(<AuditLogEmptyState />);
    expect(screen.getByText('No audit records yet')).toBeInTheDocument();
  });

  it('renders the filtered variant', () => {
    render(<AuditLogEmptyState hasActiveFilters />);
    expect(screen.getByText('No matching audit records')).toBeInTheDocument();
  });
});

describe('AuditLogFilters', () => {
  it('renders all backend-supported filter controls', () => {
    render(<AuditLogFilters filters={{}} onChange={noop} onClear={noop} />);
    expect(screen.getByLabelText('Filter by action')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by resource type')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by resource ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by actor user ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by start date')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by end date')).toBeInTheDocument();
  });

  it('does not show clear when no filters are active', () => {
    render(<AuditLogFilters filters={{}} onChange={noop} onClear={noop} />);
    expect(screen.queryByLabelText('Clear Filters')).not.toBeInTheDocument();
  });

  it('shows clear when a filter is active and calls onClear', () => {
    const onClear = vi.fn();
    render(
      <AuditLogFilters
        filters={{ action: 'incident.created' }}
        onChange={noop}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('propagates filter changes to the parent', () => {
    const onChange = vi.fn();
    render(<AuditLogFilters filters={{}} onChange={onChange} onClear={noop} />);
    fireEvent.change(screen.getByLabelText('Filter by resource type'), {
      target: { value: 'incident' },
    });
    expect(onChange).toHaveBeenCalledWith({ resource_type: 'incident' });
  });
});