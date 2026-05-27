import { EMPTY_US_ADDRESS } from '../types/address';
import type { MixDesignAdvisorFormState } from '../types/mixDesignAdvisor';

export const DEFAULT_MIX_ADVISOR_FORM: MixDesignAdvisorFormState = {
  projectUse: 'slab_on_grade',
  selectedPsi: '3000',
  exposure: 'F1',
  slumpTargetIn: '4',
  maxAggregateIn: '1',
  placementMethod: 'chute',
  finishType: 'broom',
  pumpRequired: false,
  cementType: 'type_i',
  scmOption: 'none',
  chlorideExposure: false,
  sulfateExposure: false,
  freezeThawExposure: true,
  haulTimeMinutes: '45',
  airEntrainmentRequired: true,
  unitSystem: 'imperial',
  climate: 'temperate',
  jobsiteAddress: { ...EMPTY_US_ADDRESS },
};

export const MIX_ADVISOR_STEPS = [
  { id: 'project', title: 'Project & design' },
  { id: 'placement', title: 'Placement' },
  { id: 'materials', title: 'Materials' },
  { id: 'weather', title: 'Weather' },
  { id: 'results', title: 'Recommendation' },
] as const;
