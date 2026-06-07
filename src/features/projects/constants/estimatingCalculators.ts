/** Standalone estimating calculators available in the app (existing routes only). */
export interface EstimatingCalculatorOption {
  id: string;
  title: string;
  description: string;
  path: string;
}

export const ESTIMATING_CALCULATOR_OPTIONS: EstimatingCalculatorOption[] = [
  {
    id: 'concrete',
    title: 'Concrete',
    description: 'Calculate concrete volume, bags, yards, and pour planning values.',
    path: '/calculator/concrete',
  },
  {
    id: 'labor',
    title: 'Labor',
    description: 'Estimate labor hours, man-days, crew-days, and labor cost.',
    path: '/calculator/labor',
  },
  {
    id: 'general-trade-labor',
    title: 'General Trade Labor',
    description: 'Estimate non-concrete trade labor hours, crew days, and labor cost.',
    path: '/calculator/general-trade-labor',
  },
  {
    id: 'materials',
    title: 'Materials',
    description: 'Estimate material quantities and costs with custom line items.',
    path: '/calculator/custom',
  },
  {
    id: 'rebar',
    title: 'Rebar Design',
    description: 'Estimate reinforcement quantities, spacing, lap, and cut-list support.',
    path: '/calculator/reinforcement',
  },
];

export const ESTIMATING_CALCULATORS_MODAL_TITLE = 'Estimating Calculators';

export const ESTIMATING_CALCULATORS_MODAL_COPY =
  'Use individual estimating tools for quick calculations. These can be added to proposals.';
