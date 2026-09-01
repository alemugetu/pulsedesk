/**
 * useKeyboardNavigation hook for PulseDesk.
 * 
 * Provides keyboard navigation (ArrowUp, ArrowDown, Home, End, PageUp, PageDown)
 * for menus, dropdowns, lists, and roving tabindex components.
 */

import { useState, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export interface UseKeyboardNavigationOptions {
  /** Total number of navigable items */
  itemCount: number;
  /** Initial active index */
  initialIndex?: number;
  /** Whether navigation wraps around at boundaries */
  loop?: boolean;
  /** Orientation of the items */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Callback when item at index is selected (Enter / Space) */
  onSelect?: (index: number) => void;
  /** Callback on Escape key */
  onEscape?: () => void;
}

export function useKeyboardNavigation({
  itemCount,
  initialIndex = 0,
  loop = true,
  orientation = 'vertical',
  onSelect,
  onEscape,
}: UseKeyboardNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (itemCount === 0) return;

      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (event.key) {
        case 'ArrowDown': {
          if (!isVertical) return;
          event.preventDefault();
          setActiveIndex((prev) => {
            if (prev < itemCount - 1) return prev + 1;
            return loop ? 0 : prev;
          });
          break;
        }

        case 'ArrowUp': {
          if (!isVertical) return;
          event.preventDefault();
          setActiveIndex((prev) => {
            if (prev > 0) return prev - 1;
            return loop ? itemCount - 1 : prev;
          });
          break;
        }

        case 'ArrowRight': {
          if (!isHorizontal) return;
          event.preventDefault();
          setActiveIndex((prev) => {
            if (prev < itemCount - 1) return prev + 1;
            return loop ? 0 : prev;
          });
          break;
        }

        case 'ArrowLeft': {
          if (!isHorizontal) return;
          event.preventDefault();
          setActiveIndex((prev) => {
            if (prev > 0) return prev - 1;
            return loop ? itemCount - 1 : prev;
          });
          break;
        }

        case 'Home': {
          event.preventDefault();
          setActiveIndex(0);
          break;
        }

        case 'End': {
          event.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
        }

        case 'Enter':
        case ' ': {
          if (onSelect && activeIndex >= 0 && activeIndex < itemCount) {
            event.preventDefault();
            onSelect(activeIndex);
          }
          break;
        }

        case 'Escape': {
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        }

        default:
          break;
      }
    },
    [itemCount, loop, orientation, onSelect, onEscape, activeIndex]
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
  };
}
