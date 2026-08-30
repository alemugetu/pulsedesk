import { useOrganizationContext } from '../../organizations/context/organizationContextDef';

export function useCanViewReports(): boolean {
  const { hasPermission } = useOrganizationContext();
  return hasPermission('report.view');
}

