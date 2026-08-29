/**
 * Tests for SlaStatusBadge component.
 */

import { render, screen } from '@testing-library/react';
import { SlaStatusBadge } from '../SlaStatusBadge';

describe('SlaStatusBadge', () => {
  it('renders ON_TRACK status correctly', () => {
    render(<SlaStatusBadge status="ON_TRACK" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('On Track');
    expect(badge).toHaveAttribute('aria-label', 'SLA Status: On Track');
  });

  it('renders BREACHED status correctly', () => {
    render(<SlaStatusBadge status="BREACHED" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Breached');
    expect(badge).toHaveAttribute('aria-label', 'SLA Status: Breached');
  });

  it('renders COMPLETED status correctly', () => {
    render(<SlaStatusBadge status="COMPLETED" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Completed');
    expect(badge).toHaveAttribute('aria-label', 'SLA Status: Completed');
  });

  it('applies custom className', () => {
    render(<SlaStatusBadge status="ON_TRACK" className="custom-class" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('custom-class');
  });
});
