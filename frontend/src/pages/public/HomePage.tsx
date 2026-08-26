/**
 * HomePage component - Landing page for PulseDesk.
 * 
 * Professional SaaS landing page with multiple sections.
 */

import { useEffect } from 'react';
import { Hero } from '../../features/public/components/Hero';
import { FeaturesSection } from '../../features/public/sections/FeaturesSection';
import { OperationsSection } from '../../features/public/sections/OperationsSection';
import { SLASection } from '../../features/public/sections/SLASection';
import { RealtimeSection } from '../../features/public/sections/RealtimeSection';
import { SecuritySection } from '../../features/public/sections/SecuritySection';
import { CTASection } from '../../features/public/sections/CTASection';

/**
 * HomePage component
 */
export function HomePage() {
  useEffect(() => {
    document.title = 'PulseDesk — Operations Management Platform';
  }, []);

  return (
    <>
      <Hero />
      <FeaturesSection />
      <OperationsSection />
      <SLASection />
      <RealtimeSection />
      <SecuritySection />
      <CTASection />
    </>
  );
}
