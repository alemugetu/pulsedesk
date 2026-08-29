/**
 * IncidentCategory component.
 * 
 * Displays incident category information.
 */

import type { IncidentCategoryMinimal } from '../types/incident.types';

interface IncidentCategoryProps {
  category: IncidentCategoryMinimal | null;
  className?: string;
}

export function IncidentCategory({ category, className = '' }: IncidentCategoryProps) {
  if (!category) {
    return (
      <span className={`text-sm text-muted-foreground ${className}`}>
        No category
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center text-sm ${className}`}>
      <span className="text-muted-foreground">Category:</span>
      <span className="ml-1.5 font-medium">{category.name}</span>
    </span>
  );
}
