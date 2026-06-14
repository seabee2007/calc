import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_NAME } from '../../config/brand';

const legalLinkClassName =
  'text-slate-600 transition-colors hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:text-cyan-300 dark:focus-visible:ring-cyan-400/50 dark:focus-visible:ring-offset-slate-950';

interface FooterProps {
  /** Extra space on mobile so fixed bottom nav does not cover copyright. */
  reserveMobileNavSpace?: boolean;
}

const Footer: React.FC<FooterProps> = ({ reserveMobileNavSpace = false }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`relative mt-auto w-full border-t border-slate-200 bg-white/80 px-6 py-8 text-center backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/90 sm:py-10 ${
        reserveMobileNavSpace ? 'mb-16 md:mb-0' : ''
      }`}
      style={{
        paddingLeft: 'max(env(safe-area-inset-left), 1.5rem)',
        paddingRight: 'max(env(safe-area-inset-right), 1.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-6 hidden h-20 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl dark:block"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-5">
        <img
          src="/images/ARDEN-removebg-preview.png"
          alt={`${BRAND_NAME} logo`}
          className="h-14 w-auto max-w-[min(240px,80vw)] object-contain sm:h-16"
        />

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Built for construction professionals.
        </p>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm"
          aria-label="Legal"
        >
          <Link to="/terms" className={legalLinkClassName}>
            Terms of Service
          </Link>
          <Link to="/privacy-policy" className={legalLinkClassName}>
            Privacy Policy
          </Link>
          <Link to="/contact" className={legalLinkClassName}>
            Contact Us
          </Link>
        </nav>

        <div className="h-px w-full max-w-4xl bg-slate-200 dark:bg-slate-800/70" />

        <p className="text-xs text-slate-500 dark:text-slate-500">
          © {currentYear} {BRAND_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
