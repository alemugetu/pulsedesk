/**
 * useFocusManagement hook for PulseDesk.
 * 
 * Manages focus trapping, initial focus placement, Escape key handling,
 * and focus restoration for accessible modals, dialogs, drawers, and menus.
 */

import { useEffect, useRef, type RefObject } from 'react';
import {
  trapFocus,
  saveActiveElement,
  restoreActiveElement,
  getFirstFocusableElement,
} from '../utils/focus';

export interface UseFocusManagementOptions {
  /** Whether the focus management is actively applied */
  isActive: boolean;
  /** Optional container element ref. If omitted, containerRef returned by hook can be used */
  containerRef?: RefObject<HTMLElement | null>;
  /** Element to focus initially when active. Defaults to first focusable element */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Element to return focus to on close. Defaults to previously focused element */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Whether to trap Tab focus within the container */
  trapFocusEnabled?: boolean;
}

export function useFocusManagement<T extends HTMLElement = HTMLElement>({
  isActive,
  containerRef: externalContainerRef,
  initialFocusRef,
  returnFocusRef,
  onEscape,
  trapFocusEnabled = true,
}: UseFocusManagementOptions) {
  const internalContainerRef = useRef<T | null>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Save previous active element before moving focus
    previousActiveElementRef.current = returnFocusRef?.current || saveActiveElement();

    // Move initial focus
    const frameId = requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const first = getFirstFocusableElement(containerRef.current);
        if (first) {
          first.focus();
        } else {
          // If no focusable children, focus container itself if it has tabIndex
          containerRef.current.focus();
        }
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }

      if (trapFocusEnabled && containerRef.current) {
        trapFocus(containerRef.current, event);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown, true);
      restoreActiveElement(previousActiveElementRef.current);
    };
  }, [isActive, containerRef, initialFocusRef, returnFocusRef, onEscape, trapFocusEnabled]);

  return { containerRef: containerRef as RefObject<T | null> };
}
