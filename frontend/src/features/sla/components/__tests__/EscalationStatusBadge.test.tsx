/**
 * Tests for EscalationStatusBadge component.
 */

import { render, screen } from '@testing-library/react';
import { EscalationStatusBadge } from '../EscalationStatusBadge';

describe('EscalationStatusBadge', () => {
  it('renders ACTIVE status correctly', () => {
    render(<EscalationStatusBadge status="ACTIVE" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Active');
    expect(badge).toHaveAttribute('aria-label', 'Escalation Status: Active');
  });

  it('renders COMPLETED status correctly', () => {
    render(<EscalationStatusBadge status="COMPLETED" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Completed');
    expect(badge).toHaveAttribute('aria-label', 'Escalation Status: Completed');
  });

  it('renders CANCELLED status correctly', () => {
    render(<EscalationStatusBadge status="CANCELLED" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Cancelled');
    expect(badge).toHaveAttribute('aria-label', 'Escalation Status: Cancelled');
  });

  it('applies custom className', () => {
    render(<EscalationStatusBadge status="ACTIVE" className="custom-class" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('custom-class');
  });
});
