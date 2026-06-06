import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  canScrollCarouselLeft,
  canScrollCarouselRight,
  DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL,
  FILTER_CAROUSEL_SCROLL_AREA_CLASS,
  FILTER_CHIP_SCROLL_STEP_PX,
  getFilterCarouselArrowClassName,
  getFilterChipClassName,
  shouldShowFilterCarouselArrows,
  type FilterChip,
} from '../filterChipCarouselModel';
import { PLANNER_MUTED } from '../estimateWorkspaceTheme';

export type FilterChipCarouselProps = {
  label: string;
  chips: FilterChip[];
  activeValue: string;
  onChange: (value: string) => void;
  maxVisibleBeforeCarousel?: number;
};

export default function FilterChipCarousel({
  label,
  chips,
  activeValue,
  onChange,
  maxVisibleBeforeCarousel = DEFAULT_MAX_VISIBLE_CHIPS_BEFORE_CAROUSEL,
}: FilterChipCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      setHasOverflow(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, clientWidth, scrollWidth } = element;
    setHasOverflow(scrollWidth > clientWidth + 1);
    setCanScrollLeft(canScrollCarouselLeft(scrollLeft));
    setCanScrollRight(canScrollCarouselRight(scrollLeft, clientWidth, scrollWidth));
  }, []);

  useEffect(() => {
    updateScrollState();
    const element = scrollRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    resizeObserver.observe(element);
    element.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      element.removeEventListener('scroll', updateScrollState);
    };
  }, [chips, updateScrollState]);

  const showArrows = shouldShowFilterCarouselArrows(
    chips.length,
    hasOverflow,
    maxVisibleBeforeCarousel,
  );

  const scrollByStep = (direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction === 'left' ? -FILTER_CHIP_SCROLL_STEP_PX : FILTER_CHIP_SCROLL_STEP_PX,
      behavior: 'smooth',
    });
  };

  if (chips.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>{label}</p>
      <div className="flex items-center gap-2">
        {showArrows ? (
          <button
            type="button"
            aria-label={`Scroll ${label} filters left`}
            className={getFilterCarouselArrowClassName(!canScrollLeft)}
            disabled={!canScrollLeft}
            onClick={() => scrollByStep('left')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        <div
          ref={scrollRef}
          className={`flex min-w-0 flex-1 gap-2 overflow-x-auto ${FILTER_CAROUSEL_SCROLL_AREA_CLASS}`}
        >
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={getFilterChipClassName(activeValue === chip.value)}
              onClick={() => onChange(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {showArrows ? (
          <button
            type="button"
            aria-label={`Scroll ${label} filters right`}
            className={getFilterCarouselArrowClassName(!canScrollRight)}
            disabled={!canScrollRight}
            onClick={() => scrollByStep('right')}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
