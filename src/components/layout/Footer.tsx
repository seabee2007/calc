import React from 'react';
import { BRAND_NAME } from '../../config/brand';

const legalLinkClassName =
  'text-slate-400 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111d]';

const Footer: React.FC<{ hideMarketingChrome?: boolean }> = ({ hideMarketingChrome = false }) => {
  const currentYear = new Date().getFullYear();

  if (hideMarketingChrome) {
    return (
      <footer
        className="mt-auto w-full border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
        style={{
          paddingLeft: 'max(env(safe-area-inset-left), 1.5rem)',
          paddingRight: 'max(env(safe-area-inset-right), 1.5rem)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
        }}
      >
        © {currentYear} {BRAND_NAME}
      </footer>
    );
  }

  return (
    <footer
      className="relative mt-auto w-full border-t border-white/10 bg-[#07111d]/90 px-6 py-8 text-center backdrop-blur-md sm:py-10"
      style={{
        paddingLeft: 'max(env(safe-area-inset-left), 1.5rem)',
        paddingRight: 'max(env(safe-area-inset-right), 1.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-8 h-24 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl">
        <img
          src="/images/ARDEN-removebg-preview.png"
          alt={`${BRAND_NAME} logo`}
          className="mx-auto h-auto w-[240px] max-w-[80vw] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)] sm:w-[260px]"
        />

        <p className="mt-3 text-sm text-slate-400 sm:text-base">
          Built for construction professionals.
        </p>

        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-slate-400"
          aria-label="Legal"
        >
          <a href="/terms" className={legalLinkClassName}>
            Terms of Service
          </a>

          <a href="/privacy-policy" className={legalLinkClassName}>
            Privacy Policy
          </a>

          <a href="/contact" className={legalLinkClassName}>
            Contact Us
          </a>
        </nav>

        <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-500">
          © {currentYear} {BRAND_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
