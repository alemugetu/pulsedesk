/**
 * SocialLinks component - Reusable social media links for PulseDesk.
 * 
 * Provides accessible social media links with proper external link handling.
 * Currently configured as placeholders for future social media accounts.
 */

import { cn } from '../../../utils/cn';

interface SocialLink {
  name: string;
  url: string | null;
  icon: string;
}

/**
 * Social links configuration
 * Set to null to disable a social link
 */
const socialLinks: SocialLink[] = [
  { name: 'Twitter', url: null, icon: '𝕏' },
  { name: 'LinkedIn', url: null, icon: 'in' },
  { name: 'GitHub', url: null, icon: '⌘' },
];

interface SocialLinksProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SocialLinks component for displaying social media links
 */
export function SocialLinks({ className, size = 'md' }: SocialLinksProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
  };

  const availableLinks = socialLinks.filter(link => link.url !== null);

  // Don't render if no links are available
  if (availableLinks.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)} role="list" aria-label="Social media links">
      {availableLinks.map((link) => (
        <a
          key={link.name}
          href={link.url!}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center justify-center rounded-md border border-border',
            'bg-background text-foreground transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            sizeClasses[size]
          )}
          aria-label={`Follow us on ${link.name}`}
          role="listitem"
        >
          <span aria-hidden="true">{link.icon}</span>
        </a>
      ))}
    </div>
  );
}
