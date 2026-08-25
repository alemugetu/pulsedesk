/**
 * Placeholder component for Phase 13.1 routes.
 * 
 * This is a temporary placeholder used during Phase 13.1
 * to verify routing works. Will be replaced with actual pages
 * in later phases.
 */

import { type ReactNode } from 'react';

interface PlaceholderProps {
  message: string;
}

export function Placeholder({ message }: PlaceholderProps): ReactNode {
  return <div className="p-8 text-center">{message}</div>;
}
