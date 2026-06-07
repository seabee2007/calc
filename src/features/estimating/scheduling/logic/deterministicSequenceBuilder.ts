/**
 * Deterministic construction logic sequence builder.
 *
 * Uses RULE-BASED DEPENDENCY MATCHING — not phase-order chaining.
 *
 * Links are only created when a real construction dependency exists between
 * two activities based on explicit keyword rules. This avoids the false
 * critical path produced by sortedActivities[i] → sortedActivities[i+1].
 */

import type { AiLogicSuggestion, LogicRelationshipType } from './logicTypes';
import type { CpmLogicLink } from '../cpmTypes';
import { wouldCreateCircularDependency } from './logicCycleUtils';

// ── Public types ──────────────────────────────────────────────────────────────

export interface LogicActivity {
  activityCode: string;
  title: string;
  divisionCode?: string;
  divisionName?: string;
  workPackageName?: string;
}

export interface ClassifiedActivity {
  activityCode: string;
  title: string;
  phase: string;
  trade: string;
  sequenceRank: number;
  csiPrefix: string;
}

/** Extends AiLogicSuggestion with a source field for display in the review modal. */
export interface DeterministicSuggestion extends AiLogicSuggestion {
  source: 'deterministic' | 'ai-added';
}

export interface DeterministicSequenceResult {
  suggestedLinks: DeterministicSuggestion[];
  matchedActivities: ClassifiedActivity[];
  unmatchedActivities: {
    activityCode: string;
    title: string;
    reason: string;
  }[];
  warnings: string[];
  isForcedChainWarning: boolean;
  longestChainLength: number;
}

// ── Dependency rule type ──────────────────────────────────────────────────────

interface DependencyRule {
  id: string;
  successorKeywords: string[];
  predecessorKeywords: string[];
  dependencyType: 'FS' | 'SS' | 'FF';
  lagDays?: number;
  numericConfidence: number;
  reason: string;
}

// ── Residential dependency rules ──────────────────────────────────────────────

const RESIDENTIAL_DEPENDENCY_RULES: DependencyRule[] = [
  {
    id: 'permits-before-mobilization',
    successorKeywords: ['mobilization', 'mobilize', 'preconstruction meeting'],
    predecessorKeywords: ['permit', 'inspection coordination', 'permitting'],
    dependencyType: 'FS',
    numericConfidence: 0.75,
    reason: 'Permits and inspection coordination should be in place before field mobilization.',
  },
  {
    id: 'mobilization-before-clearing',
    successorKeywords: ['clearing', 'grubbing', 'demolition', 'site clearing'],
    predecessorKeywords: ['mobilization', 'mobilize', 'temporary facilities'],
    dependencyType: 'FS',
    numericConfidence: 0.75,
    reason: 'Site clearing follows mobilization.',
  },
  {
    id: 'layout-before-excavation',
    successorKeywords: ['excavat', 'footing trench', 'building excavat'],
    predecessorKeywords: ['site verification', 'utility locate', 'layout', 'survey', 'batter board'],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'Excavation should follow site verification, utility locate, and building layout.',
  },
  {
    id: 'clearing-before-grading',
    successorKeywords: ['rough grad', 'mass grad', 'cut and fill', 'grading'],
    predecessorKeywords: ['clearing', 'grubbing', 'site clearing'],
    dependencyType: 'FS',
    numericConfidence: 0.85,
    reason: 'Rough grading follows site clearing.',
  },
  // Foundation hard-coded sequence
  {
    id: 'excavation-before-footing-rebar',
    successorKeywords: ['footing reinforcement', 'footing rebar', 'rebar footing'],
    predecessorKeywords: ['excavat', 'footing trench'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Footing reinforcement cannot be installed until footing excavation is complete.',
  },
  {
    id: 'footing-rebar-before-forms',
    successorKeywords: ['form footing', 'footing forms', 'slab edge', 'edge form'],
    predecessorKeywords: ['footing reinforcement', 'footing rebar', 'rebar footing'],
    dependencyType: 'FS',
    numericConfidence: 0.85,
    reason: 'Footing forms follow footing reinforcement placement.',
  },
  {
    id: 'forms-before-footing-pour',
    successorKeywords: [
      'place concrete footing',
      'pour footing',
      'pour concrete footing',
      'concrete footing',
    ],
    predecessorKeywords: ['form footing', 'footing forms', 'footing rebar', 'footing reinforcement'],
    dependencyType: 'FS',
    numericConfidence: 0.98,
    reason: 'Footing concrete cannot be placed until forms and reinforcement are ready.',
  },
  {
    id: 'footing-pour-before-slab-base',
    successorKeywords: ['vapor barrier', 'slab base', 'gravel base', 'under-slab', 'slab prep'],
    predecessorKeywords: [
      'place concrete footing',
      'pour footing',
      'pour concrete footing',
      'concrete footing',
    ],
    dependencyType: 'FS',
    lagDays: 1,
    numericConfidence: 0.9,
    reason: 'Slab base and vapor barrier should follow footing concrete placement.',
  },
  {
    id: 'slab-base-before-slab-pour',
    successorKeywords: [
      'place and finish slab',
      'slab on grade',
      'slab-on-grade',
      'pour slab',
      'place slab',
    ],
    predecessorKeywords: ['vapor barrier', 'slab base', 'gravel base', 'under-slab'],
    dependencyType: 'FS',
    numericConfidence: 0.98,
    reason: 'Slab concrete cannot be placed until base and vapor barrier are complete.',
  },
  {
    id: 'slab-cure-before-framing',
    successorKeywords: [
      'frame exterior',
      'frame interior',
      'wall framing',
      'exterior wall',
      'framing',
    ],
    predecessorKeywords: [
      'place and finish slab',
      'slab on grade',
      'pour slab',
      'place slab',
    ],
    dependencyType: 'FS',
    lagDays: 7,
    numericConfidence: 0.95,
    reason: 'Wall framing should not start until slab concrete has cured (7-day lag).',
  },
  {
    id: 'walls-before-roof-structure',
    successorKeywords: ['roof truss', 'roof framing', 'truss install', 'truss'],
    predecessorKeywords: ['frame exterior', 'frame interior', 'wall framing', 'framing'],
    dependencyType: 'FS',
    numericConfidence: 0.98,
    reason: 'Roof truss installation depends on completed wall framing.',
  },
  {
    id: 'roof-structure-before-sheathing',
    successorKeywords: ['roof sheathing', 'wall sheathing', 'sheathing'],
    predecessorKeywords: ['roof truss', 'roof framing', 'truss'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Roof sheathing follows roof structure.',
  },
  {
    id: 'sheathing-before-housewrap',
    successorKeywords: ['house wrap', 'housewrap', 'weather barrier', 'building wrap'],
    predecessorKeywords: ['sheathing', 'wall sheathing'],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'House wrap follows wall sheathing.',
  },
  {
    id: 'sheathing-before-underlayment',
    successorKeywords: ['roof underlayment', 'underlayment', 'dry-in', 'roofing'],
    predecessorKeywords: ['roof sheathing', 'sheathing'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Roofing and underlayment follow roof sheathing.',
  },
  {
    id: 'housewrap-before-windows',
    successorKeywords: [
      'exterior window',
      'install window',
      'window install',
      'exterior door',
    ],
    predecessorKeywords: ['house wrap', 'housewrap', 'weather barrier'],
    dependencyType: 'FS',
    numericConfidence: 0.85,
    reason: 'Window and door installation follows house wrap and flashing.',
  },
  {
    id: 'dryin-before-mep',
    // Broadened: all three MEP trades, not just HVAC
    successorKeywords: [
      'hvac rough',
      'mechanical rough',
      'ductwork rough',
      'electrical rough',
      'plumbing rough',
      'mep rough',
    ],
    predecessorKeywords: ['roofing', 'roof underlayment', 'dry-in', 'house wrap', 'windows'],
    dependencyType: 'FS',
    numericConfidence: 0.75,
    reason: 'MEP rough-ins should begin after the structure is dried in.',
  },
  {
    id: 'hvac-before-plumbing-rough',
    successorKeywords: ['plumbing rough', 'rough plumbing', 'rough-in plumbing', 'dwv'],
    predecessorKeywords: ['hvac rough', 'ductwork rough', 'mechanical rough'],
    dependencyType: 'SS',
    numericConfidence: 0.75,
    reason: 'Plumbing rough-in should coordinate after HVAC routes are established.',
  },
  {
    id: 'plumbing-before-electrical-rough',
    // Updated: broader keyword set for electrical rough-in
    successorKeywords: ['electrical rough', 'rough electric', 'wire pull', 'electrical box'],
    predecessorKeywords: ['plumbing rough', 'rough plumbing', 'rough-in plumbing'],
    dependencyType: 'FS',
    numericConfidence: 0.8,
    reason: 'Electrical rough-in follows plumbing line stabilization.',
  },
  // NEW: MEP systems must pass inspection before walls are closed with insulation
  {
    id: 'mep-rough-before-inspection',
    successorKeywords: [
      'mep inspection',
      'rough inspection',
      'framing inspection',
      'close-in inspection',
    ],
    predecessorKeywords: ['electrical rough', 'plumbing rough', 'hvac rough', 'rough-in'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Rough-in systems must be complete before municipal close-in inspection.',
  },
  // NEW: Inspection gate before insulation (replaces generic roughins-before-insulation)
  {
    id: 'inspection-before-insulation',
    successorKeywords: ['insulation', 'batt insulation', 'foam insulation', 'wall insulation'],
    predecessorKeywords: [
      'mep inspection',
      'rough inspection',
      'framing inspection',
      'close-in inspection',
    ],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Insulation requires a passed framing and MEP rough-in inspection sign-off.',
  },
  {
    id: 'insulation-before-drywall-hang',
    // Updated: broader drywall boarding keywords
    successorKeywords: ['drywall hanging', 'hang drywall', 'drywall board', 'gypsum board'],
    predecessorKeywords: ['insulation', 'batt insulation', 'foam insulation'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Drywall covers the studs and requires insulation to be complete first.',
  },
  {
    id: 'drywall-hang-before-finish',
    // Updated: matched boarding keywords from above
    successorKeywords: ['drywall mud', 'drywall tape', 'drywall finish', 'tape and mud'],
    predecessorKeywords: ['drywall hanging', 'hang drywall', 'drywall board', 'gypsum board'],
    dependencyType: 'FS',
    numericConfidence: 0.98,
    reason: 'Drywall finishing follows boarding.',
  },
  {
    id: 'drywall-finish-before-paint',
    // Updated: broader finish-to-paint keywords
    successorKeywords: ['interior painting', 'paint wall', 'primer coat', 'prime and paint'],
    predecessorKeywords: [
      'drywall mud',
      'drywall tape',
      'drywall finish',
      'tape and mud',
      'drywall sanding',
    ],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'Wall painting follows completed and sanded drywall finishes.',
  },
  // NEW: trim carpentry (baseboard, doors, molding) follows first coat of paint
  {
    id: 'paint-before-trim',
    successorKeywords: ['baseboard', 'interior door install', 'trim carpentry', 'molding'],
    predecessorKeywords: ['interior painting', 'paint wall', 'primer coat'],
    dependencyType: 'FS',
    numericConfidence: 0.75,
    reason: 'Applying wall primer or first coat minimises cutting-in work around finish trim.',
  },
  {
    id: 'trim-before-cabinets',
    // Updated: replaces flooring-before-cabinets; trim/door casing sets before cabinet install
    successorKeywords: ['cabinet installation', 'kitchen cabinet', 'vanity install'],
    predecessorKeywords: ['baseboard', 'interior door install', 'trim carpentry'],
    dependencyType: 'FS',
    numericConfidence: 0.8,
    reason: 'Cabinet installation integrates with finish interior casing and trim schedules.',
  },
  {
    id: 'cabinets-before-countertops',
    successorKeywords: ['countertop', 'stone install', 'granite countertop'],
    predecessorKeywords: ['cabinet installation', 'kitchen cabinet', 'vanity install'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Countertops cannot be templated or installed until lower cabinets are locked in place.',
  },
  {
    id: 'countertops-before-plumbing-trim',
    successorKeywords: ['plumbing fixture', 'sink install', 'faucet trim', 'toilet set'],
    predecessorKeywords: ['countertop', 'stone install', 'granite countertop'],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'Plumbing fixtures and sinks anchor directly to finish countertops.',
  },
  {
    id: 'paint-before-electrical-trim',
    // Updated: cleaner keyword set
    successorKeywords: ['electrical trim', 'switch plate', 'light fixture install', 'device trim'],
    predecessorKeywords: ['interior painting', 'paint wall', 'drywall finish'],
    dependencyType: 'FS',
    numericConfidence: 0.85,
    reason: 'Final painting should finish before installing wall outlet plates and decorative light fixtures.',
  },
  {
    id: 'trim-before-appliances',
    successorKeywords: [
      'appliance',
      'refrigerator',
      'dishwasher',
      'oven',
      'range',
      'washer',
      'dryer',
      'appliance install',
    ],
    predecessorKeywords: [
      'plumbing fixture',
      'plumbing trim',
      'countertop',
      'electrical trim',
    ],
    dependencyType: 'FS',
    numericConfidence: 0.85,
    reason: 'Appliances require trim-out readiness and finished surfaces.',
  },
  {
    id: 'trimout-before-final-inspection',
    successorKeywords: ['final inspection', 'building final', 'certificate of occupancy', 'punchlist'],
    predecessorKeywords: [
      'plumbing fixture',
      'electrical trim',
      'appliance install',
      'hvac trim',
    ],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'Final inspections should follow trim-out and installed equipment.',
  },
  {
    id: 'final-clean-before-punch',
    successorKeywords: ['punch list'],
    predecessorKeywords: ['final clean', 'final cleaning', 'cleanup', 'clean up'],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'Punch list follows final cleaning and quality walkthrough.',
  },
  {
    id: 'inspection-before-punch',
    successorKeywords: ['punch list'],
    predecessorKeywords: ['final inspection'],
    dependencyType: 'FS',
    numericConfidence: 0.9,
    reason: 'Punch list follows final inspection.',
  },
  {
    id: 'punch-before-turnover',
    successorKeywords: ['turnover', 'warranty', 'handover', 'project closeout'],
    predecessorKeywords: ['punch list'],
    dependencyType: 'FS',
    numericConfidence: 0.95,
    reason: 'Turnover and warranty package follow punch list correction.',
  },
];

// ── Float activity patterns (NOT forced into main chain) ─────────────────────

const FLOAT_ACTIVITY_PATTERNS = [
  'project supervision',
  'quality control',
  'temporary facilit',
  'temp facilit',
  'site control',
  'exterior flatwork',
  'exterior painting',
  'exterior stain',
  'siding',
  'cladding',
  'landscaping',
  'landscape',
  'irrigation',
  'final touch',
  'accessories',
  'mirrors',
  'hardware',
  'specialty',
  'site clean',
];

// ── Phase classification for display/reporting ────────────────────────────────

const PHASE_KEYWORD_RULES: Array<{
  phase: string;
  trade: string;
  rank: number;
  keywords: string[];
}> = [
  {
    phase: 'Preconstruction',
    trade: 'General',
    rank: 10,
    keywords: [
      'preconstruction',
      'mobiliz',
      'permit',
      'temporary facilit',
      'project supervision',
      'quality control',
      'coordination',
    ],
  },
  {
    phase: 'Sitework',
    trade: 'Sitework',
    rank: 20,
    keywords: ['clearing', 'grubbing', 'demolition', 'remove', 'survey', 'layout', 'batter board'],
  },
  {
    phase: 'Earthwork',
    trade: 'Earthwork',
    rank: 30,
    keywords: [
      'excavat',
      'rough grad',
      'mass grad',
      'compaction',
      'earthwork',
      'cut and fill',
      'trench',
    ],
  },
  {
    phase: 'Site Utilities',
    trade: 'Utilities',
    rank: 40,
    keywords: [
      'underground utility',
      'sewer lateral',
      'water main',
      'utility installation',
      'underground pipe',
    ],
  },
  {
    phase: 'Foundation Concrete',
    trade: 'Concrete',
    rank: 50,
    keywords: [
      'footing',
      'footings',
      'form footing',
      'rebar footing',
      'reinforce footing',
      'foundation wall',
      'stem wall',
      'waterproof',
      'backfill',
      'slab base',
      'vapor barrier',
      'slab on grade',
      'slab-on-grade',
      'place slab',
      'pour slab',
      'concrete footing',
      'concrete slab',
      'place and finish slab',
    ],
  },
  {
    phase: 'Framing',
    trade: 'Framing',
    rank: 80,
    keywords: [
      'wall fram',
      'frame wall',
      'frame exterior',
      'frame interior',
      'roof truss',
      'roof framing',
      'subfloor',
      'roof sheathing',
      'wall sheathing',
      'sheathing',
      'framing',
      'blocking',
    ],
  },
  {
    phase: 'Dry-In',
    trade: 'Envelope',
    rank: 90,
    keywords: [
      'house wrap',
      'weather barrier',
      'housewrap',
      'flashing',
      'roof underlayment',
      'dry-in',
      'dry in',
      'window install',
      'exterior door install',
      'windows',
      'exterior doors',
      'roofing',
    ],
  },
  {
    phase: 'MEP Rough-In',
    trade: 'MEP',
    rank: 120,
    keywords: [
      'hvac rough',
      'mechanical rough',
      'plumbing rough',
      'rough plumbing',
      'rough-in plumbing',
      'electrical rough',
      'rough electric',
      'wire pull',
      'mep rough',
      'ductwork',
      'dwv',
      'branch circuit',
      'rough-in',
    ],
  },
  {
    phase: 'Inspection',
    trade: 'Inspection',
    rank: 145,
    keywords: [
      'mep inspection',
      'rough inspection',
      'framing inspection',
      'close-in inspection',
    ],
  },
  {
    phase: 'Insulation',
    trade: 'Insulation',
    rank: 150,
    keywords: ['insulat', 'batt insulation', 'foam insulation', 'spray foam', 'wall insulation'],
  },
  {
    phase: 'Drywall',
    trade: 'Drywall',
    rank: 160,
    keywords: [
      'hang drywall',
      'drywall hanging',
      'drywall board',
      'gypsum board',
      'drywall',
      'tape and mud',
      'drywall mud',
      'drywall tape',
      'drywall finish',
      'drywall sanding',
    ],
  },
  {
    phase: 'Interior Finishes',
    trade: 'Finishes',
    rank: 168,
    keywords: [
      'prime',
      'primer coat',
      'interior painting',
      'paint wall',
      'prime and paint',
      'flooring',
      'hardwood',
      'tile',
      'casing',
      'baseboard',
      'trim carpentry',
      'molding',
      'cabinet installation',
      'countertop',
      'stone install',
      'granite countertop',
      'carpet',
    ],
  },
  {
    phase: 'Trim-Out',
    trade: 'Trim',
    rank: 182,
    keywords: [
      'plumbing fixture',
      'sink install',
      'faucet trim',
      'toilet set',
      'electrical trim',
      'switch plate',
      'light fixture install',
      'device trim',
      'hvac trim',
      'thermostat',
      'appliance install',
      'appliance',
    ],
  },
  {
    phase: 'Closeout',
    trade: 'Closeout',
    rank: 200,
    keywords: [
      'final clean',
      'final inspection',
      'punch list',
      'certificate of occupancy',
      'turnover',
      'warranty',
      'closeout',
    ],
  },
];

const CSI_PHASE_RANKS: Record<string, { rank: number; phase: string; trade: string }> = {
  '01': { rank: 10, phase: 'Preconstruction', trade: 'General' },
  '02': { rank: 20, phase: 'Sitework', trade: 'Sitework' },
  '31': { rank: 30, phase: 'Earthwork', trade: 'Earthwork' },
  '32': { rank: 35, phase: 'Exterior Improvements', trade: 'Sitework' },
  '33': { rank: 40, phase: 'Site Utilities', trade: 'Utilities' },
  '03': { rank: 50, phase: 'Foundation Concrete', trade: 'Concrete' },
  '04': { rank: 60, phase: 'Masonry', trade: 'Masonry' },
  '05': { rank: 70, phase: 'Metals', trade: 'Structural' },
  '06': { rank: 80, phase: 'Framing', trade: 'Framing' },
  '07': { rank: 90, phase: 'Dry-In', trade: 'Envelope' },
  '08': { rank: 100, phase: 'Openings', trade: 'Envelope' },
  '21': { rank: 110, phase: 'MEP Rough-In', trade: 'Fire Suppression' },
  '22': { rank: 120, phase: 'MEP Rough-In', trade: 'Plumbing' },
  '23': { rank: 130, phase: 'MEP Rough-In', trade: 'HVAC' },
  '26': { rank: 140, phase: 'MEP Rough-In', trade: 'Electrical' },
  '27': { rank: 145, phase: 'MEP Rough-In', trade: 'Low Voltage' },
  '09': { rank: 160, phase: 'Interior Finishes', trade: 'Finishes' },
  '10': { rank: 170, phase: 'Specialties', trade: 'Specialties' },
  '11': { rank: 180, phase: 'Equipment', trade: 'Equipment' },
  '12': { rank: 175, phase: 'Interior Finishes', trade: 'Furnishings' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim();
}

function matchScore(title: string, keywords: string[]): number {
  const t = normalizeTitle(title);
  let score = 0;
  for (const kw of keywords) {
    if (t.includes(kw.toLowerCase())) score += kw.length;
  }
  return score;
}

function isFloatActivity(title: string): boolean {
  const t = normalizeTitle(title);
  return FLOAT_ACTIVITY_PATTERNS.some((p) => t.includes(p.toLowerCase()));
}

function extractCsiPrefix(activityCode: string, divisionCode?: string): string {
  const dashMatch = activityCode.trim().match(/^(\d{2})[-.]/);
  if (dashMatch) return dashMatch[1]!;
  const divMatch = (divisionCode ?? '').trim().match(/^(\d{2})/);
  if (divMatch) return divMatch[1]!;
  return '';
}

function classifyActivity(activity: LogicActivity): ClassifiedActivity {
  const t = normalizeTitle(activity.title);
  const csiPrefix = extractCsiPrefix(activity.activityCode, activity.divisionCode);

  let bestKeyword: (typeof PHASE_KEYWORD_RULES)[0] | null = null;
  let bestScore = 0;
  for (const rule of PHASE_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (t.includes(kw.toLowerCase())) {
        const s = kw.length;
        if (s > bestScore) {
          bestScore = s;
          bestKeyword = rule;
        }
      }
    }
  }

  const csiMatch = csiPrefix ? CSI_PHASE_RANKS[csiPrefix] : null;

  if (bestKeyword) {
    return {
      activityCode: activity.activityCode,
      title: activity.title,
      phase: bestKeyword.phase,
      trade: bestKeyword.trade,
      sequenceRank: bestKeyword.rank,
      csiPrefix,
    };
  }

  if (csiMatch) {
    return {
      activityCode: activity.activityCode,
      title: activity.title,
      phase: csiMatch.phase,
      trade: csiMatch.trade,
      sequenceRank: csiMatch.rank,
      csiPrefix,
    };
  }

  return {
    activityCode: activity.activityCode,
    title: activity.title,
    phase: 'Unclassified',
    trade: 'Unknown',
    sequenceRank: 999,
    csiPrefix,
  };
}

function numericToConfidence(n: number): 'high' | 'medium' | 'low' {
  if (n >= 0.75) return 'high';
  if (n >= 0.5) return 'medium';
  return 'low';
}

// ── Longest path (for chain detection) ───────────────────────────────────────

function computeLongestChainLength(
  activityCodes: string[],
  links: Array<{ predecessorActivityCode: string; successorActivityCode: string }>,
): number {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const code of activityCodes) {
    adj.set(code, []);
    inDeg.set(code, 0);
  }
  for (const link of links) {
    if (adj.has(link.predecessorActivityCode) && adj.has(link.successorActivityCode)) {
      adj.get(link.predecessorActivityCode)!.push(link.successorActivityCode);
      inDeg.set(
        link.successorActivityCode,
        (inDeg.get(link.successorActivityCode) ?? 0) + 1,
      );
    }
  }

  const dist = new Map<string, number>();
  for (const code of activityCodes) dist.set(code, 1);
  const queue = activityCodes.filter((c) => (inDeg.get(c) ?? 0) === 0);
  let maxDist = 1;

  while (queue.length > 0) {
    const node = queue.shift()!;
    const d = dist.get(node) ?? 1;
    maxDist = Math.max(maxDist, d);
    for (const succ of adj.get(node) ?? []) {
      const newDist = d + 1;
      if (newDist > (dist.get(succ) ?? 1)) dist.set(succ, newDist);
      inDeg.set(succ, (inDeg.get(succ) ?? 0) - 1);
      if (inDeg.get(succ) === 0) queue.push(succ);
    }
  }

  return maxDist;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildDeterministicLogicSequence(input: {
  activities: LogicActivity[];
  existingLinks: CpmLogicLink[];
  projectType?: string;
  projectLocation?: string;
}): DeterministicSequenceResult {
  const { activities, existingLinks } = input;

  if (activities.length === 0) {
    return {
      suggestedLinks: [],
      matchedActivities: [],
      unmatchedActivities: [],
      warnings: [],
      isForcedChainWarning: false,
      longestChainLength: 0,
    };
  }

  const classified = activities.map(classifyActivity);
  const suggestions: DeterministicSuggestion[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];
  let idCounter = 0;

  const linksSoFar = (): CpmLogicLink[] => [
    ...existingLinks,
    ...suggestions.map((s) => ({
      predecessorActivityCode: s.predecessorActivityCode,
      successorActivityCode: s.successorActivityCode,
      relationshipType: s.relationshipType,
      lagDays: s.lagDays,
    })),
  ];

  for (const rule of RESIDENTIAL_DEPENDENCY_RULES) {
    const successorCandidates = activities.filter(
      (a) => matchScore(a.title, rule.successorKeywords) > 0,
    );
    const predecessorCandidates = activities.filter(
      (a) => matchScore(a.title, rule.predecessorKeywords) > 0,
    );

    if (successorCandidates.length === 0 || predecessorCandidates.length === 0) continue;

    for (const succ of successorCandidates) {
      const succClass = classified.find((c) => c.activityCode === succ.activityCode)!;

      const eligiblePreds = predecessorCandidates
        .filter((p) => p.activityCode !== succ.activityCode)
        .map((p) => {
          const pClass = classified.find((c) => c.activityCode === p.activityCode)!;
          return {
            activity: p,
            classif: pClass,
            score: matchScore(p.title, rule.predecessorKeywords),
          };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return a.classif.sequenceRank - b.classif.sequenceRank;
        });

      if (eligiblePreds.length === 0) continue;

      let bestPred = eligiblePreds[0]!;
      const predsBelowSucc = eligiblePreds.filter(
        (p) => p.classif.sequenceRank < succClass.sequenceRank,
      );
      if (predsBelowSucc.length > 0) {
        bestPred = predsBelowSucc.reduce((best, curr) =>
          curr.classif.sequenceRank > best.classif.sequenceRank ? curr : best,
        );
      }

      const predCode = bestPred.activity.activityCode;
      const succCode = succ.activityCode;
      const dupKey = `${predCode}→${succCode}`;

      if (seen.has(dupKey)) continue;
      if (
        existingLinks.some(
          (l) =>
            l.predecessorActivityCode === predCode && l.successorActivityCode === succCode,
        )
      )
        continue;

      const lagDays = rule.lagDays ?? 0;
      const relType: LogicRelationshipType = rule.dependencyType;

      if (
        wouldCreateCircularDependency(linksSoFar(), [
          {
            predecessorActivityCode: predCode,
            successorActivityCode: succCode,
            relationshipType: relType,
            lagDays,
            reason: '',
          },
        ])
      ) {
        warnings.push(`Skipped circular link (rule "${rule.id}"): ${predCode} → ${succCode}`);
        continue;
      }

      const confidence = numericToConfidence(rule.numericConfidence);
      if (confidence === 'low') continue;

      suggestions.push({
        id: `det-${predCode}-${succCode}-${idCounter++}`,
        confidence,
        issue: 'main-sequence',
        predecessorActivityCode: predCode,
        successorActivityCode: succCode,
        relationshipType: relType,
        lagDays,
        reason: rule.reason,
        source: 'deterministic',
      });
      seen.add(dupKey);
    }
  }

  // Identify touched activity codes
  const touchedCodes = new Set<string>();
  for (const s of suggestions) {
    touchedCodes.add(s.predecessorActivityCode);
    touchedCodes.add(s.successorActivityCode);
  }

  const unmatchedActivities: DeterministicSequenceResult['unmatchedActivities'] = [];
  for (const activity of activities) {
    if (!touchedCodes.has(activity.activityCode)) {
      const isFloat = isFloatActivity(activity.title);
      unmatchedActivities.push({
        activityCode: activity.activityCode,
        title: activity.title,
        reason: isFloat
          ? 'Float/parallel work — wire manually when needed'
          : 'No dependency rule matched — wire manually',
      });
    }
  }

  const floatCount = unmatchedActivities.filter((u) => isFloatActivity(u.title)).length;
  const unknownCount = unmatchedActivities.length - floatCount;
  if (floatCount > 0)
    warnings.push(
      `${floatCount} float/support activit${floatCount === 1 ? 'y' : 'ies'} (supervision, temporary, exterior, etc.) were intentionally left unlinked.`,
    );
  if (unknownCount > 0)
    warnings.push(
      `${unknownCount} activit${unknownCount === 1 ? 'y' : 'ies'} could not be matched to a dependency rule — wire them manually.`,
    );

  // Straight-line chain detection
  const allCodes = activities.map((a) => a.activityCode);
  const longestChainLength = computeLongestChainLength(allCodes, suggestions);
  const isForcedChainWarning =
    activities.length >= 5 && longestChainLength / activities.length > 0.8;

  if (isForcedChainWarning) {
    warnings.push(
      `Warning: ${longestChainLength} of ${activities.length} activities form one single path. This looks like a forced straight-line chain.`,
    );
  }

  return {
    suggestedLinks: suggestions,
    matchedActivities: classified.filter((c) => c.phase !== 'Unclassified'),
    unmatchedActivities,
    warnings,
    isForcedChainWarning,
    longestChainLength,
  };
}
