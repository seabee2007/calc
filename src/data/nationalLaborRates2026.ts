/** National average labor rates (2026) — itemized by trade. */
export interface LaborTradeRate {
  trade: string;
  hourlyRateBase: number;
  hourlyRateWithBurden: number;
  overtimeMultiplier: number;
  nationalAverage2026?: boolean;
  includes?: string[];
}

export interface LaborRatesCatalog {
  concreteLaborer: LaborTradeRate;
  concreteFinisher: LaborTradeRate;
  foreman: LaborTradeRate;
}

export const LABOR_RATES_2026 = {
  laborRates: {
    concreteLaborer: {
      trade: 'Concrete Laborer',
      hourlyRateBase: 28,
      hourlyRateWithBurden: 42,
      overtimeMultiplier: 1.5,
      nationalAverage2026: true,
      includes: [
        'base wage',
        'payroll burden',
        'workers comp',
        'small tools',
        'general labor overhead',
      ],
    },
    concreteFinisher: {
      trade: 'Concrete Finisher',
      hourlyRateBase: 36,
      hourlyRateWithBurden: 54,
      overtimeMultiplier: 1.5,
      nationalAverage2026: true,
      includes: [
        'base wage',
        'payroll burden',
        'workers comp',
        'small tools',
        'general labor overhead',
      ],
    },
    foreman: {
      trade: 'Concrete Foreman',
      hourlyRateBase: 48,
      hourlyRateWithBurden: 72,
      overtimeMultiplier: 1.5,
      nationalAverage2026: true,
      includes: [
        'base wage',
        'payroll burden',
        'workers comp',
        'small tools',
        'general labor overhead',
      ],
    },
  },
} as const satisfies { laborRates: LaborRatesCatalog };

/** @deprecated Use LABOR_RATES_2026.laborRates */
export const NATIONAL_LABOR_RATES_2026 = LABOR_RATES_2026.laborRates;
