export type FilterChip = {
  value: string;
  label: string;
};

export const FILTER_CHIP_SCROLL_STEP_PX = 220;
export const DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL = 4;
export const FILTER_CAROUSEL_SCROLL_AREA_CLASS = 'no-scrollbar';

export function shouldShowFilterCarouselArrows(
  chipCount: number,
  hasOverflow: boolean,
  maxVisibleBeforeCarousel = DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL,
): boolean {
  return chipCount > maxVisibleBeforeCarousel || hasOverflow;
}

export function getFilterChipClassName(active: boolean): string {
  return [
    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
    active
      ? 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:border-cyan-400 dark:bg-cyan-500/10 dark:text-cyan-100'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-cyan-500/60',
  ].join(' ');
}

export function getFilterCarouselArrowClassName(disabled: boolean): string {
  return [
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm transition-colors',
    disabled
      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-600'
      : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-500/60 hover:text-cyan-700 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-cyan-200',
  ].join(' ');
}

export function canScrollCarouselLeft(scrollLeft: number): boolean {
  return scrollLeft > 1;
}

export function canScrollCarouselRight(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): boolean {
  return scrollLeft + clientWidth < scrollWidth - 1;
}
