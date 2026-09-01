/**
 * Focus utilities for PulseDesk.
 * 
 * Provides robust focus tracking, retrieval of focusable elements,
 * focus trapping within containers (modals, dialogs, drawers),
 * and focus restoration on unmount/dismissal.
 */

export const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

/**
 * Retrieves all visible, keyboard-focusable elements within a container element.
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  );

  return elements.filter((el) => {
    // Filter out elements hidden via style or attributes
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.offsetParent === null && el.style.position !== 'fixed') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}

/**
 * Gets the first focusable element inside a container.
 */
export function getFirstFocusableElement(container: HTMLElement | null): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements.length > 0 ? elements[0] : null;
}

/**
 * Gets the last focusable element inside a container.
 */
export function getLastFocusableElement(container: HTMLElement | null): HTMLElement | null {
  const elements = getFocusableElements(container);
  return elements.length > 0 ? elements[elements.length - 1] : null;
}

/**
 * Traps Tab and Shift+Tab focus navigation within a container.
 * Returns true if the event was handled and prevented, false otherwise.
 */
export function trapFocus(container: HTMLElement | null, event: KeyboardEvent): boolean {
  if (!container || event.key !== 'Tab') return false;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement;

  if (event.shiftKey) {
    // Shift + Tab: if on first or outside, move to last
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
      return true;
    }
  } else {
    // Tab: if on last or outside, move to first
    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
      return true;
    }
  }

  return false;
}

/**
 * Captures currently focused element.
 */
export function saveActiveElement(): HTMLElement | null {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    return document.activeElement;
  }
  return null;
}

/**
 * Restores focus to a previously saved element safely.
 */
export function restoreActiveElement(element: HTMLElement | null): void {
  if (!element || typeof element.focus !== 'function') return;

  // Delay slightly to prevent race conditions during modal unmount
  requestAnimationFrame(() => {
    try {
      if (document.body.contains(element)) {
        element.focus();
      }
    } catch {
      // Ignore if element is no longer focusable
    }
  });
}
