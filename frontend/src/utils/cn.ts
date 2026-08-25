/**
 * Utility function for composing Tailwind CSS class names.
 * 
 * This provides a simple way to merge class names, handling:
 * - Conditional classes
 * - String concatenation
 * - Duplicate removal
 * - Tailwind class conflicts
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes
    .filter(Boolean)
    .join(' ')
    .replace(/(\S+)\s+\1/g, '$1') // Remove duplicates
    .trim();
}

/**
 * Type for the cn function
 */
export type ClassNameInput = string | undefined | null | false;
