/**
 * Organization Settings feature exports.
 */

// Types
export type {
  OrganizationSettings,
  OrganizationSettingsUpdateRequest,
  OrganizationSettingsUpdateResponse,
  OrganizationSettingsError,
  IncidentPriority,
  IncidentStatus,
} from './types/organizationSettings.types';

export {
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_PRIORITY_CHOICES,
  INCIDENT_STATUS_CHOICES,
} from './types/organizationSettings.types';

// Services
export {
  getOrganizationSettings,
  updateOrganizationSettings,
} from './services/organizationSettingsService';

// Hooks
export {
  useOrganizationSettings,
  getOrganizationSettingsQueryKey,
} from './hooks/useOrganizationSettings';

// Components
export { OrganizationSettingsForm } from './components/OrganizationSettingsForm';
export { SettingsSection } from './components/SettingsSection';
export { SettingsField } from './components/SettingsField';
export { SettingsSaveBar } from './components/SettingsSaveBar';

// Utils
export {
  areSettingsEqual,
  getChangedFields,
  isValidIncidentPriority,
  isValidIncidentStatus,
  formatSettingsError,
} from './utils/organizationSettingsUtils';
