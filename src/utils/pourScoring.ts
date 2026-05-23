import { ForecastDay } from '../types';

export type PourRating = 'excellent' | 'good' | 'fair' | 'poor' | 'avoid';

export interface ScoredPourDay extends ForecastDay {
  rating: PourRating;
  score: number;
  reasons: string[];
  precautions: string[];
}

const RATING_ORDER: PourRating[] = ['excellent', 'good', 'fair', 'poor', 'avoid'];

export function scoreToRating(score: number): PourRating {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'avoid';
}

export function ratingColor(rating: PourRating): string {
  switch (rating) {
    case 'excellent': return 'green';
    case 'good': return 'emerald';
    case 'fair': return 'yellow';
    case 'poor': return 'orange';
    case 'avoid': return 'red';
  }
}

export function ratingLabel(rating: PourRating): string {
  switch (rating) {
    case 'excellent': return 'Ideal';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
    case 'avoid': return 'Avoid';
  }
}

function hasSevereConditions(conditions: string): boolean {
  const lower = conditions.toLowerCase();
  return (
    lower.includes('hail') ||
    lower.includes('snow') ||
    lower.includes('blizzard') ||
    lower.includes('ice') ||
    lower.includes('sleet') ||
    lower.includes('freez') ||
    lower.includes('thunder')
  );
}

export function scorePourDay(day: ForecastDay & { avgHumidity?: number }): ScoredPourDay {
  let score = 100;
  const reasons: string[] = [];
  const precautions: string[] = [];
  const conditionsLower = day.conditions.toLowerCase();

  if (day.minTemp <= 32) {
    score -= 55;
    reasons.push(`Freezing low (${Math.round(day.minTemp)}°F)`);
    precautions.push('Use non-chloride accelerator and protect from freeze until 70% strength');
  } else if (day.minTemp < 40) {
    score -= 30;
    reasons.push(`Cold overnight low (${Math.round(day.minTemp)}°F)`);
    precautions.push('Heat mixing water and use Type C accelerator');
  } else if (day.minTemp < 50) {
    score -= 10;
    reasons.push(`Cool morning low (${Math.round(day.minTemp)}°F)`);
  }

  if (day.maxTemp > 90) {
    score -= 40;
    reasons.push(`Extreme heat (${Math.round(day.maxTemp)}°F)`);
    precautions.push('Pour early morning/evening; use retarder and chilled water');
  } else if (day.maxTemp > 85) {
    score -= 18;
    reasons.push(`Hot conditions (${Math.round(day.maxTemp)}°F)`);
    precautions.push('Schedule pour for cooler hours; consider Type D retarder');
  }

  if (day.chanceOfRain > 60 || conditionsLower.includes('heavy rain')) {
    score -= 45;
    reasons.push(`High rain risk (${day.chanceOfRain}%)`);
    precautions.push('Reschedule unless covered; protect fresh concrete from rain');
  } else if (day.chanceOfRain > 30) {
    score -= 20;
    reasons.push(`Rain possible (${day.chanceOfRain}%)`);
    precautions.push('Have tarps ready; monitor radar before ordering truck');
  }

  if (day.totalPrecipitation > 0.25) {
    score -= 15;
    reasons.push(`Expected precipitation (${day.totalPrecipitation.toFixed(2)}")`);
  }

  if (day.maxWindSpeed > 20) {
    score -= 35;
    reasons.push(`High wind (up to ${Math.round(day.maxWindSpeed)} mph)`);
    precautions.push('Erect windbreaks; increase curing compound application');
  } else if (day.maxWindSpeed > 15) {
    score -= 15;
    reasons.push(`Moderate wind (up to ${Math.round(day.maxWindSpeed)} mph)`);
    precautions.push('Use evaporation retarder after screeding');
  }

  if (hasSevereConditions(day.conditions)) {
    score -= 50;
    reasons.push(`Severe weather: ${day.conditions}`);
    precautions.push('Do not pour — wait for clearing conditions');
  }

  const humidity = day.avgHumidity ?? 50;
  if (day.maxTemp > 85 && humidity < 50 && day.maxWindSpeed > 10) {
    score -= 15;
    reasons.push('High plastic-shrinkage risk (heat + low humidity + wind)');
    precautions.push('Fogging, evaporation retarder, and windbreaks required');
  }

  score = Math.max(0, Math.min(100, score));
  const rating = scoreToRating(score);

  if (rating === 'excellent' || rating === 'good') {
    if (reasons.length === 0) {
      reasons.push('Temperature, rain, and wind within ideal pour range');
    }
  }

  return {
    ...day,
    rating,
    score,
    reasons,
    precautions,
  };
}

export function scoreForecastDays(
  days: (ForecastDay & { avgHumidity?: number })[],
): ScoredPourDay[] {
  return days.map(scorePourDay);
}

export function findBestPourWindow(days: ScoredPourDay[]): {
  start: string;
  end: string;
  days: ScoredPourDay[];
} | null {
  const pourable = days.filter((d) => d.rating === 'excellent' || d.rating === 'good');
  if (pourable.length === 0) return null;

  let bestStart = 0;
  let bestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i < days.length; i++) {
    const good = days[i].rating === 'excellent' || days[i].rating === 'good';
    if (good) {
      if (currentLen === 0) currentStart = i;
      currentLen++;
    } else {
      if (currentLen > bestLen) {
        bestLen = currentLen;
        bestStart = currentStart;
      }
      currentLen = 0;
      currentStart = -1;
    }
  }
  if (currentLen > bestLen) {
    bestLen = currentLen;
    bestStart = currentStart;
  }

  if (bestLen === 0) {
    const best = pourable.reduce((a, b) => (a.score >= b.score ? a : b));
    return { start: best.date, end: best.date, days: [best] };
  }

  const windowDays = days.slice(bestStart, bestStart + bestLen);
  return {
    start: windowDays[0].date,
    end: windowDays[windowDays.length - 1].date,
    days: windowDays,
  };
}

export function compareByRating(a: ScoredPourDay, b: ScoredPourDay): number {
  return RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating);
}
