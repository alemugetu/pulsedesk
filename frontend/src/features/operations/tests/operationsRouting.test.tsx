/**
 * Tests for the Phase 13.9 routing/navigation wiring.
 *
 * Verifies the Operations Command Center is reachable at /app/operations and
 * that it replaced the disabled Dashboard placeholder in the navigation model.
 */

import { describe, it, expect } from 'vitest';
import { routeConfig } from '../../../routes/routeConfig';
import {
  findNavigationItemByPath,
  getVisibleNavigationItems,
} from '../../navigation/navigation';

describe('operations routing', () => {
  it('registers /app/operations under the protected AppLayout', () => {
    const appRoute = routeConfig[0]?.children?.find((route) => route.path === '/app');
    const operationsRoute = appRoute?.children?.find((route) => route.path === 'operations');

    expect(operationsRoute).toBeDefined();
  });

  it('is exposed in the navigation model at /app/operations', () => {
    const item = findNavigationItemByPath('/app/operations');

    expect(item).toBeDefined();
    expect(item?.id).toBe('operations');
    expect(item?.label).toBe('Operations');
    expect(item?.disabled).toBeFalsy();
  });

  it('replaces the disabled Dashboard placeholder (no /app/dashboard item)', () => {
    expect(findNavigationItemByPath('/app/dashboard')).toBeUndefined();
  });

  it('is visible to authenticated users', () => {
    const visible = getVisibleNavigationItems('authenticated');
    expect(visible.find((item) => item.id === 'operations')).toBeDefined();
  });
});