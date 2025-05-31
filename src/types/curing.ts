export interface CureProfile {
  day: number;
  pct: number;
}

export type MixProfileType = 'standard' | 'highEarly' | 'highStrength' | 'rapidSet';

export const CURE_PROFILES: Record<MixProfileType, CureProfile[]> = {
  standard: [
    { day: 0, pct: 0 },
    { day: 3, pct: 25 },
    { day: 7, pct: 45 },
    { day: 14, pct: 75 },
    { day: 28, pct: 100 },
  ],
  highEarly: [
    { day: 0, pct: 0 },
    { day: 3, pct: 50 },
    { day: 7, pct: 75 },
    { day: 14, pct: 90 },
    { day: 28, pct: 100 },
  ],
  highStrength: [
    { day: 0, pct: 0 },
    { day: 3, pct: 20 },
    { day: 7, pct: 40 },
    { day: 14, pct: 70 },
    { day: 28, pct: 100 },
  ],
  rapidSet: [
    { day: 0, pct: 5 },
    { day: 3, pct: 45 },
    { day: 7, pct: 70 },
    { day: 14, pct: 90 },
    { day: 28, pct: 100 },
  ],
};

export const MIX_PROFILE_LABELS: Record<MixProfileType, string> = {
  standard: 'Standard (3000 PSI)',
  highEarly: 'High Early-Strength',
  highStrength: 'High-Strength (5000 PSI)',
  rapidSet: 'Rapid-Set',
};