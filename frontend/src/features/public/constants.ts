/**
 * Public website constants for PulseDesk.
 * 
 * Stable constants for navigation, metadata, and public content.
 */

/**
 * Site metadata
 */
export const SITE_NAME = 'PulseDesk';
export const SITE_TAGLINE = 'Operations Management Platform';
export const SITE_DESCRIPTION = 'Streamline incident management, SLA tracking, and operations with PulseDesk.';

/**
 * Navigation routes
 */
export const NAV_ROUTES = {
  HOME: { path: '/', label: 'Home' },
  FEATURES: { path: '/features', label: 'Features' },
  ABOUT: { path: '/about', label: 'About' },
  CONTACT: { path: '/contact', label: 'Contact' },
} as const;

/**
 * Authentication routes
 * Phase 13.3: Full authentication implementation
 */
export const AUTH_ROUTES = {
  LOGIN: { path: '/login', label: 'Sign In' },
  REGISTER: { path: '/register', label: 'Get Started' },
  VERIFY_EMAIL: { path: '/verify-email', label: 'Verify Email' },
  FORGOT_PASSWORD: { path: '/forgot-password', label: 'Forgot Password' },
  RESET_PASSWORD: { path: '/reset-password', label: 'Reset Password' },
} as const;

/**
 * Legal route placeholders
 */
export const LEGAL_ROUTES = {
  PRIVACY: { path: '/privacy', label: 'Privacy Policy' },
  TERMS: { path: '/terms', label: 'Terms of Service' },
} as const;

/**
 * Footer link groups
 */
export const FOOTER_LINKS = {
  PRODUCT: [
    { label: 'Features', path: NAV_ROUTES.FEATURES.path },
  ],
  COMPANY: [
    { label: 'About', path: NAV_ROUTES.ABOUT.path },
    { label: 'Contact', path: NAV_ROUTES.CONTACT.path },
  ],
  LEGAL: [
    { label: 'Privacy Policy', path: LEGAL_ROUTES.PRIVACY.path },
    { label: 'Terms of Service', path: LEGAL_ROUTES.TERMS.path },
  ],
} as const;

/**
 * Core platform capabilities (based on existing backend functionality)
 */
export const PLATFORM_CAPABILITIES = [
  'Incident Management',
  'SLA Management',
  'Escalation',
  'Real-Time Operations',
  'Notifications',
  'Role-Based Access Control',
  'Multi-Tenant Organizations',
  'Reporting',
  'Audit History',
] as const;
