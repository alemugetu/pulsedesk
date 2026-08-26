/**
 * CTASection component - Call-to-action section for landing page.
 * 
 * Provides a strong final call-to-action.
 */

import { PublicCTA } from '../components/PublicCTA';
import { CTA_CONTENT } from '../content';

/**
 * CTASection component for landing page
 */
export function CTASection() {
  return (
    <PublicCTA
      title={CTA_CONTENT.title}
      subtitle={CTA_CONTENT.subtitle}
      primaryCta={CTA_CONTENT.primaryCta}
      secondaryCta={CTA_CONTENT.secondaryCta}
    />
  );
}
