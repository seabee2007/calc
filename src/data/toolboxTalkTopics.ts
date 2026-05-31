import type { ToolboxTalk } from '../types/fieldTools';

export type ToolboxTalkTopicKey =
  | 'heat_stress'
  | 'concrete_burns'
  | 'silica_dust'
  | 'ppe'
  | 'lifting_back'
  | 'working_around_equipment'
  | 'pump_hose_safety'
  | 'fall_protection'
  | 'electrical_safety'
  | 'housekeeping'
  | 'hydration'
  | 'trenching_safety';

export const TOOLBOX_TALK_TOPIC_OPTIONS: { value: ToolboxTalkTopicKey; label: string }[] = [
  { value: 'heat_stress', label: 'Heat stress' },
  { value: 'concrete_burns', label: 'Concrete burns' },
  { value: 'silica_dust', label: 'Silica dust' },
  { value: 'ppe', label: 'PPE' },
  { value: 'lifting_back', label: 'Lifting and back safety' },
  { value: 'working_around_equipment', label: 'Working around equipment' },
  { value: 'pump_hose_safety', label: 'Pump hose safety' },
  { value: 'fall_protection', label: 'Fall protection' },
  { value: 'electrical_safety', label: 'Electrical safety' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'hydration', label: 'Hydration' },
  { value: 'trenching_safety', label: 'Trenching safety' },
];

const TOPICS: Record<ToolboxTalkTopicKey, Omit<ToolboxTalk, 'topicKey'>> = {
  heat_stress: {
    title: 'Heat Stress on the Jobsite',
    explanation:
      'Hot weather raises body temperature fast when you are pouring, finishing, or handling materials in the sun. Heat illness can happen before you feel thirsty.',
    keyHazards: [
      'Dehydration and heat exhaustion',
      'Dizziness or confusion on elevated decks',
      'Sunburn and long-term skin damage',
    ],
    safePractices: [
      'Take water breaks in shade every 15–20 minutes in hot weather',
      'Schedule heavy work for cooler parts of the day when possible',
      'Watch crew members for heavy sweating, cramps, or confusion',
      'Use a buddy system during heat advisories',
    ],
    crewReminder: 'If you feel dizzy, nauseous, or stop sweating — stop work and tell the foreman immediately.',
    supervisorQuestion: 'Where is our shade and water station today, and who is checking on newer crew members?',
  },
  concrete_burns: {
    title: 'Concrete Burns and Skin Contact',
    explanation:
      'Fresh concrete is highly alkaline. Wet concrete on skin can cause serious burns that may not show up until hours later.',
    keyHazards: [
      'Chemical burns from wet concrete on skin',
      'Eye injury from splashes',
      'Boots and pants saturated with alkaline mix',
    ],
    safePractices: [
      'Wear gloves and long pants — avoid skin contact with fresh mix',
      'Wash skin with clean water immediately if concrete gets on you',
      'Do not wipe dry concrete off skin; flush with water',
      'Keep eye wash or clean water available near placement area',
    ],
    crewReminder: 'Treat wet concrete like a chemical — wash off right away, even if it feels fine at first.',
    supervisorQuestion: 'Does everyone have gloves and a way to rinse off near the pour today?',
  },
  silica_dust: {
    title: 'Silica Dust Exposure',
    explanation:
      'Cutting, grinding, or drilling concrete and masonry puts respirable silica in the air. Silica dust can cause serious lung disease over time.',
    keyHazards: [
      'Invisible silica dust during cutting and chipping',
      'Dust exposure in enclosed or low-wind areas',
      'Accumulated dust on clothing taken home',
    ],
    safePractices: [
      'Use wet methods or dust collection when cutting or grinding',
      'Wear a respirator when required by the exposure plan',
      'Stay out of the dust cloud — position upwind when possible',
      'Do not eat or drink in dusty work areas',
    ],
    crewReminder: 'If you see a dust cloud, step back and make sure controls are in place before continuing.',
    supervisorQuestion: 'What tasks today create silica dust, and what control method are we using for each?',
  },
  ppe: {
    title: 'Personal Protective Equipment (PPE)',
    explanation:
      'PPE is the last line of defense. Today we confirm everyone has the right gear for the tasks on this pour.',
    keyHazards: [
      'Impacts from tools, materials, and equipment',
      'Eye injuries from flying debris',
      'Foot injuries from loads and uneven ground',
    ],
    safePractices: [
      'Hard hat, eye protection, gloves, and boots required in active work zones',
      'Hi-vis vests where trucks and equipment are moving',
      'Hearing protection where cutting or equipment noise is high',
      'Replace damaged PPE — do not work with broken straps or cracked lenses',
    ],
    crewReminder: 'No PPE, no work in the active zone. Ask the foreman if you need a replacement.',
    supervisorQuestion: 'Does anyone need replacement PPE before we start placement?',
  },
  lifting_back: {
    title: 'Lifting and Back Safety',
    explanation:
      'Rebar, form materials, and hoses cause most lifting injuries. Team lifts and good technique prevent lost time.',
    keyHazards: [
      'Back strains from awkward or solo lifts',
      'Dropped loads when grip or footing fails',
      'Reaching and twisting while carrying weight',
    ],
    safePractices: [
      'Get help for loads over ~50 lb or awkward shapes',
      'Bend knees, keep load close, avoid twisting',
      'Use mechanical aids (forklift, hoist, dolly) when available',
      'Clear trip hazards before carrying materials',
    ],
    crewReminder: 'If it feels too heavy, it is a team lift — ask before you hurt your back.',
    supervisorQuestion: 'What heavy lifts are planned today and how are we handling them?',
  },
  working_around_equipment: {
    title: 'Working Around Equipment',
    explanation:
      'Concrete trucks, pumps, and skid steers move in tight spaces. Operators have blind spots — stay alert and communicate.',
    keyHazards: [
      'Struck-by from moving equipment',
      'Crush points between truck and obstacles',
      'Unexpected movement during backing',
    ],
    safePractices: [
      'Make eye contact with operators before entering work zones',
      'Use spotters for backing and tight placements',
      'Stay out of swing radius and blind spots',
      'Never ride on buckets, hooks, or exterior truck steps',
    ],
    crewReminder: 'If you cannot see the operator, they probably cannot see you — stay clear until waved in.',
    supervisorQuestion: 'Who is spotting equipment today and where are our exclusion zones marked?',
  },
  pump_hose_safety: {
    title: 'Pump Hose Safety',
    explanation:
      'Concrete pump lines are under high pressure. A failed coupling or kink can whip the hose and cause serious injury.',
    keyHazards: [
      'Hose whipping if blockage releases suddenly',
      'Pinch points at clamps and reducers',
      'Struck-by from hose movement',
    ],
    safePractices: [
      'Keep exclusion zone clear during pumping — no unnecessary personnel',
      'Never stand on or over a pressurized hose',
      'Communicate blockages to operator immediately — do not bang on line',
      'Inspect clamps and wear pads before pour',
    ],
    crewReminder: 'Stay back from the hose during pressure-up and initial pumping.',
    supervisorQuestion: 'Is our hose exclusion zone marked and does the crew know the hand signals?',
  },
  fall_protection: {
    title: 'Fall Protection',
    explanation:
      'Edges, wall openings, and elevated decks need protection before work starts — not after someone is already exposed.',
    keyHazards: [
      'Unprotected edges and wall openings',
      'Falls through weakened formwork or decks',
      'Improper ladder use',
    ],
    safePractices: [
      'Guardrails, covers, or tie-off per site fall protection plan',
      'Inspect ladders and access before use',
      'Keep openings covered and marked',
      'Report missing guards or damaged decks immediately',
    ],
    crewReminder: 'If you are working at height, confirm protection is in place before you step out.',
    supervisorQuestion: 'What elevated work is happening today and what fall protection is installed?',
  },
  electrical_safety: {
    title: 'Electrical Safety',
    explanation:
      'Temporary power, cord tools, and overhead lines are common on pour days. Treat every line as energized until verified.',
    keyHazards: [
      'Contact with overhead or buried utilities',
      'Damaged extension cords and GFCI failure',
      'Water near energized equipment',
    ],
    safePractices: [
      'Maintain clearance from overhead lines per utility guidance',
      'Use GFCI protection on temporary circuits',
      'Inspect cords — replace frayed or damaged equipment',
      'Keep connections dry and off the ground where possible',
    ],
    crewReminder: 'Look up and around before booms, pumps, or ladders go up.',
    supervisorQuestion: 'Are GFCI outlets working and are any cord tools damaged on site today?',
  },
  housekeeping: {
    title: 'Housekeeping',
    explanation:
      'A clean jobsite prevents slips, trips, and fires. Good housekeeping keeps trucks moving and crews safe.',
    keyHazards: [
      'Trips over rebar, lumber, and hoses',
      'Fires from oily rags and trash near heaters',
      'Blocked access for emergency vehicles',
    ],
    safePractices: [
      'Stack materials in designated areas — keep walkways clear',
      'Pick up trash and empty drums at end of shift',
      'Coil hoses and cords when not in use',
      'Keep fire extinguishers accessible and unobstructed',
    ],
    crewReminder: 'Leave your work area cleaner than you found it — trips hurt people and slow the pour.',
    supervisorQuestion: 'Where is trash and scrap going today, and are walkways clear for trucks?',
  },
  hydration: {
    title: 'Hydration',
    explanation:
      'Even mild dehydration affects focus and reaction time. On pour days, drinking water regularly is part of the job.',
    keyHazards: [
      'Fatigue and poor judgment from dehydration',
      'Heat illness when water intake is too low',
      'Cramps during long shifts',
    ],
    safePractices: [
      'Drink water before you feel thirsty',
      'Avoid heavy caffeine and alcohol before hot shifts',
      'Alternate water with short breaks in shade',
      'Bring personal water bottles — refill at station',
    ],
    crewReminder: 'Take a drink every break — your focus keeps the crew safe.',
    supervisorQuestion: 'Is the water cooler filled and in shade for the full shift?',
  },
  trenching_safety: {
    title: 'Trenching Safety',
    explanation:
      'Trenches and excavations can collapse without warning. Only enter trenches protected by slope, bench, shield, or shore.',
    keyHazards: [
      'Cave-in and engulfment',
      'Underground utilities',
      'Materials and spoils falling into excavation',
    ],
    safePractices: [
      'Call 811 and verify locates before digging',
      'Keep spoils at least 2 ft from edge when possible',
      'Use competent person inspections daily and after rain',
      'Never enter unprotected trench over 5 ft deep',
    ],
    crewReminder: 'If the trench looks different after rain or a nearby load — stop and get it re-inspected.',
    supervisorQuestion: 'Who is the competent person today and has this excavation been inspected?',
  },
};

export function getToolboxTalk(topicKey: ToolboxTalkTopicKey): ToolboxTalk {
  const content = TOPICS[topicKey];
  return { topicKey, ...content };
}

export function getToolboxTalkByKey(key: string): ToolboxTalk | null {
  if (!(key in TOPICS)) return null;
  return getToolboxTalk(key as ToolboxTalkTopicKey);
}
