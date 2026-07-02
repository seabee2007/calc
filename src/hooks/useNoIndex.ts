import { useEffect } from 'react';

/**
 * Adds a `<meta name="robots" content="noindex, nofollow">` tag to the document
 * head while the calling component is mounted, then removes it on unmount.
 *
 * Used by public, token-gated pages (proposals, change orders, contracts,
 * client portals, invites) so that shareable token URLs are not indexed by
 * search engines if they leak through email, referrers, history, or logs.
 * This complements the `Disallow` rules in `public/robots.txt`.
 */
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    meta.setAttribute('data-managed-by', 'useNoIndex');
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);
}
