/**
 * PublicFooter component - Global footer for PulseDesk public website.
 * 
 * Provides organized navigation links and copyright information.
 */

import { Link } from 'react-router-dom';
import { FOOTER_LINKS, SITE_NAME } from '../constants';
import { SocialLinks } from './SocialLinks';

/**
 * PublicFooter component for public website
 */
export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Product
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {FOOTER_LINKS.PRODUCT.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-md"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Company
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {FOOTER_LINKS.COMPANY.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-md"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Legal
            </h3>
            <ul className="mt-4 space-y-2" role="list">
              {FOOTER_LINKS.LEGAL.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background rounded-md"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Connect
            </h3>
            <div className="mt-4">
              <SocialLinks size="sm" />
              <p className="mt-3 text-xs text-muted-foreground">
                Follow us for updates and news
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © {currentYear} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
