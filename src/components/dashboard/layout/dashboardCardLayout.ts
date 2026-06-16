/**
 * Helpers for resizable dashboard cards — compact action labels when a card is
 * half-width or smaller (including mobile single-column stack).
 */

/** Grid columns at or below this width use compact action button labels. */
export const COMPACT_ACTION_CARD_WIDTH = 6;

/**
 * True when dashboard card action buttons should use short labels.
 * Responds to the card's grid width (not viewport alone) so a half-width hero
 * on desktop still shows "Start" / "Quote".
 */
export function isCompactDashboardCard(cardWidth?: number, isMobile?: boolean): boolean {
  if (isMobile) return true;
  if (cardWidth == null) return false;
  return cardWidth <= COMPACT_ACTION_CARD_WIDTH;
}
