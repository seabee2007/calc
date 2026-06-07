export interface LaborFieldDefinition {
  id: string;
  title: string;
  short: string;
  plain: string;
  options?: readonly string[];
  showInFormTooltip?: boolean;
}

export const LABOR_FIELD_DEFINITIONS: readonly LaborFieldDefinition[] = [
  {
    id: 'production_rate',
    title: 'Production rate',
    short: 'How fast the work is completed.',
    plain:
      'This tells the app how much work can be done in a certain amount of time. Example: 100 SF per hour, or 2 labor hours per unit.',
    showInFormTooltip: true,
  },
  {
    id: 'production_rate_type',
    title: 'Production rate type',
    short: 'How the app reads your production rate.',
    plain: 'Choose the option that matches how you know the work rate.',
    options: [
      'Units per labor hour',
      'Units per labor day',
      'Labor hours per unit',
    ],
    showInFormTooltip: true,
  },
  {
    id: 'crew_size',
    title: 'Crew size',
    short: 'Number of workers assigned to this activity.',
    plain:
      'A larger crew may finish faster, but the total labor hours can stay the same.',
    showInFormTooltip: true,
  },
  {
    id: 'hours_per_day',
    title: 'Hours per day',
    short: 'Work hours per crew day.',
    plain:
      'Usually 8 hours per day unless the crew is working overtime or a shorter shift.',
    showInFormTooltip: true,
  },
  {
    id: 'labor_rate',
    title: 'Labor rate',
    short: 'Cost per labor hour.',
    plain: 'This is the hourly labor cost used to price the work.',
    showInFormTooltip: true,
  },
  {
    id: 'burden_percent',
    title: 'Burden %',
    short: 'Extra labor cost for taxes, insurance, benefits, and similar costs.',
    plain:
      'Burden can include payroll tax, insurance, benefits, workers comp, and other labor costs.',
    showInFormTooltip: true,
  },
  {
    id: 'difficulty_factor',
    title: 'Difficulty factor',
    short: 'Use higher than 1.0 when the work is harder than normal.',
    plain:
      'Use 1.0 for normal work. Use higher than 1.0 for harder work. Example: 1.25 adds 25% more labor.',
    showInFormTooltip: true,
  },
  {
    id: 'location_factor',
    title: 'Location factor',
    short: 'Use higher than 1.0 when local conditions make work slower or more expensive.',
    plain:
      'Use 1.0 for normal conditions. Use higher than 1.0 if the location makes work slower or more expensive.',
    showInFormTooltip: true,
  },
  {
    id: 'labor_hours',
    title: 'Labor hours',
    short: 'Total hours of work needed.',
    plain: 'If 2 workers work 8 hours, that is 16 labor hours.',
  },
  {
    id: 'man_days',
    title: 'Man-days',
    short: 'One worker for one workday.',
    plain: '40 labor hours divided by 8 hours per day equals 5 man-days.',
  },
  {
    id: 'crew_days',
    title: 'Crew-days',
    short: 'One full crew working for one day.',
    plain: 'If a 5-person crew works one day, that is 1 crew-day.',
  },
];

const DEFINITION_BY_ID = new Map(LABOR_FIELD_DEFINITIONS.map((entry) => [entry.id, entry]));

export function getLaborFieldDefinition(id: string): LaborFieldDefinition | undefined {
  return DEFINITION_BY_ID.get(id);
}

export function getLaborFormTooltipDefinitions(): LaborFieldDefinition[] {
  return LABOR_FIELD_DEFINITIONS.filter((entry) => entry.showInFormTooltip);
}
