/**
 * Tests for IncidentFilters component
 * 
 * Tests the incident filter controls.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentFilters } from '../components/IncidentFilters';

describe('IncidentFilters', () => {
  it('should render filter controls', () => {
    const handleStatusChange = vi.fn();
    const handlePriorityChange = vi.fn();
    const handleAssigneeChange = vi.fn();
    const handleCategoryChange = vi.fn();
    const handleClearFilters = vi.fn();

    render(
      <IncidentFilters
        status="OPEN"
        priority="P1"
        assignee="user1"
        category="cat1"
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onAssigneeChange={handleAssigneeChange}
        onCategoryChange={handleCategoryChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={true}
      />
    );

    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Assignee: user1')).toBeInTheDocument();
    expect(screen.getByText('Category: cat1')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('should call onStatusChange when status changes', () => {
    const handleStatusChange = vi.fn();
    const handlePriorityChange = vi.fn();
    const handleAssigneeChange = vi.fn();
    const handleCategoryChange = vi.fn();
    const handleClearFilters = vi.fn();

    render(
      <IncidentFilters
        status="OPEN"
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onAssigneeChange={handleAssigneeChange}
        onCategoryChange={handleCategoryChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={true}
      />
    );

    const statusSelect = screen.getByLabelText('Status');
    fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });

    expect(handleStatusChange).toHaveBeenCalledWith('RESOLVED');
  });

  it('should call onPriorityChange when priority changes', () => {
    const handleStatusChange = vi.fn();
    const handlePriorityChange = vi.fn();
    const handleAssigneeChange = vi.fn();
    const handleCategoryChange = vi.fn();
    const handleClearFilters = vi.fn();

    render(
      <IncidentFilters
        priority="P1"
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onAssigneeChange={handleAssigneeChange}
        onCategoryChange={handleCategoryChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={true}
      />
    );

    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.change(prioritySelect, { target: { value: 'P2' } });

    expect(handlePriorityChange).toHaveBeenCalledWith('P2');
  });

  it('should call onClearFilters when clear button is clicked', () => {
    const handleStatusChange = vi.fn();
    const handlePriorityChange = vi.fn();
    const handleAssigneeChange = vi.fn();
    const handleCategoryChange = vi.fn();
    const handleClearFilters = vi.fn();

    render(
      <IncidentFilters
        status="OPEN"
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onAssigneeChange={handleAssigneeChange}
        onCategoryChange={handleCategoryChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={true}
      />
    );

    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    expect(handleClearFilters).toHaveBeenCalled();
  });

  it('should not show clear filters button when no active filters', () => {
    const handleStatusChange = vi.fn();
    const handlePriorityChange = vi.fn();
    const handleAssigneeChange = vi.fn();
    const handleCategoryChange = vi.fn();
    const handleClearFilters = vi.fn();

    render(
      <IncidentFilters
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onAssigneeChange={handleAssigneeChange}
        onCategoryChange={handleCategoryChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={false}
      />
    );

    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
  });
});
