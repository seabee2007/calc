import React from 'react';
import { Ruler } from 'lucide-react';
import ConstructionCalculator from '../../features/tools/construction-calculator/ui/ConstructionCalculator';
import { CC_PAGE_HERO_SUBTITLE, CC_PAGE_HERO_TITLE } from '../../theme/pageTypography';
import { PREMIUM_PANEL } from '../../theme/appTheme';

export default function ArdenFieldCalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl pb-8">
      <header className="mb-6 flex gap-4 items-start">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cyan-600/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
          <Ruler className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <h1 className={CC_PAGE_HERO_TITLE}>Arden Field Calculator</h1>
          <p className={CC_PAGE_HERO_SUBTITLE}>
            Feet-inch-fraction math, unit conversions, and trade calculators for the field and office.
          </p>
        </div>
      </header>

      <div className={PREMIUM_PANEL + ' p-4 sm:p-6'}>
        <ConstructionCalculator layout="desktop" />
      </div>
    </div>
  );
}
