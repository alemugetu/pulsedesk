/**
 * React hook for managing incident filter state.
 * 
 * Provides a centralized way to manage filter state for incident list.
 * Integrates with URL search params for shareable filter states.
 */

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { IncidentFilters, IncidentStatus, IncidentPriority, SLAState } from '../types/incident.types';

/**
 * Hook to manage incident filter state
 * 
 * Syncs with URL search params for shareable filter states
 * 
 * @returns Filter state and management functions
 */
export function useIncidentFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<IncidentFilters>(() => {
    return {
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as IncidentStatus) || undefined,
      priority: (searchParams.get('priority') as IncidentPriority) || undefined,
      assignee: searchParams.get('assignee') || undefined,
      category: searchParams.get('category') || undefined,
      created_after: searchParams.get('created_after') || undefined,
      created_before: searchParams.get('created_before') || undefined,
      sla_state: (searchParams.get('sla_state') as SLAState) || undefined,
      ordering: searchParams.get('ordering') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    };
  });

  /**
   * Update a single filter
   */
  const setFilter = useCallback(<K extends keyof IncidentFilters>(key: K, value: IncidentFilters[K]) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      if (value === undefined || value === null || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
      setSearchParams(newParams);
      
      return updated;
    });
  }, [searchParams, setSearchParams]);

  /**
   * Update multiple filters at once
   */
  const setFiltersBulk = useCallback((newFilters: Partial<IncidentFilters>) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      setSearchParams(newParams);
      
      return updated;
    });
  }, [searchParams, setSearchParams]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = Object.values(filters).some(
    value => value !== undefined && value !== null && value !== ''
  );

  return {
    filters,
    setFilter,
    setFiltersBulk,
    clearFilters,
    hasActiveFilters,
  };
}
