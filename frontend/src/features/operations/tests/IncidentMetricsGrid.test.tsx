/**
 * Tests for IncidentMetricsGrid.
 *
 * Prop-driven presentational grid: loading skeletons, error + retry, and
 * metric cards (including links to the relevant incident views).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Flame, AlertTriangle } from 'lucide-react';
import { IncidentMetricsGrid } from '../components/IncidentMetricsGrid';
import type { IncidentMetricData } from '../components/IncidentMetricCard';

const metrics: IncidentMetricData[] = [
  { id: 'open', label: 'Open Incidents', value: 1234, icon: AlertTriangle },
  { id: 'critical', label: 'Critical Incidents', value: 2, icon: Flame, tone: 'critical', href: '/app/incidents?priority=P1' },
];

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('IncidentMetricsGrid', () => {
  it('renders loading skeleton cards while loading', () => {
    const { container } = wrap(
      <IncidentMetricsGrid metrics={[]} isLoading error={null} />
    );

    // 4 skeleton placeholders when no metric shape is available yet
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });

  it('renders an error state with a retry action', () => {
    const onRetry = vi.fn();
    wrap(
      <IncidentMetricsGrid
        metrics={[]}
        isLoading={false}
        error="Unable to load summary"
        onRetry={onRetry}
      />
    );

    expect(screen.getAllByText('Unable to load summary').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders metric cards with formatted values', () => {
    wrap(<IncidentMetricsGrid metrics={metrics} isLoading={false} error={null} />);

    expect(screen.getByText('Open Incidents')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Critical Incidents')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('wraps href-backed metrics in a link to the relevant incident view', () => {
    wrap(<IncidentMetricsGrid metrics={metrics} isLoading={false} error={null} />);

    const link = screen.getByRole('link', { name: 'View critical incidents' });
    expect(link).toHaveAttribute('href', '/app/incidents?priority=P1');
  });

  it('renders cards without href as non-interactive cards', () => {
    wrap(<IncidentMetricsGrid metrics={[metrics[0]]} isLoading={false} error={null} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});