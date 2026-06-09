export interface PilotSurveyFormValues {
  workRole: string;
  currentTools: string;
  testedProjectType: string;
  firstImpression: string;
  professionalTrustRating: string;
  initialConfusion: string;
  easyToFind: string;
  hardestFeatureToFind: string;
  workflowMakesSense: string;
  workflowConfusingParts: string;
  easyToReadNavigate: string;
  crowdedOrUnfinishedScreen: string;
  bestScreenOrFeature: string;
  needsImprovementScreenOrFeature: string;
  mostUsefulFeature: string;
  confusingOrNotUsefulFeature: string;
  missingExpectedFeature: string;
  savesTimeRating: string;
  bugsOrWrongInfo: string;
  fixFirst: string;
  topThreeLiked: string;
  topThreeNeedsWork: string;
  willingToTestNextVersion: string;
  finalComments: string;
}

export interface PilotSurveyResponse extends PilotSurveyFormValues {
  id: string;
  userId: string;
  userEmail: string | null;
  submittedAt: string;
  updatedAt: string;
}

export const EMPTY_PILOT_SURVEY: PilotSurveyFormValues = {
  workRole: '',
  currentTools: '',
  testedProjectType: '',
  firstImpression: '',
  professionalTrustRating: '',
  initialConfusion: '',
  easyToFind: '',
  hardestFeatureToFind: '',
  workflowMakesSense: '',
  workflowConfusingParts: '',
  easyToReadNavigate: '',
  crowdedOrUnfinishedScreen: '',
  bestScreenOrFeature: '',
  needsImprovementScreenOrFeature: '',
  mostUsefulFeature: '',
  confusingOrNotUsefulFeature: '',
  missingExpectedFeature: '',
  savesTimeRating: '',
  bugsOrWrongInfo: '',
  fixFirst: '',
  topThreeLiked: '',
  topThreeNeedsWork: '',
  willingToTestNextVersion: '',
  finalComments: '',
};

export const WORK_ROLE_OPTIONS = [
  'Contractor',
  'Project manager',
  'Estimator',
  'Field supervisor',
  'Owner/client',
  'Other',
] as const;

export const YES_SOMEWHAT_NO_OPTIONS = ['Yes', 'Somewhat', 'No'] as const;

export const YES_MAYBE_NO_OPTIONS = ['Yes', 'Maybe', 'No'] as const;

export const MOST_USEFUL_FEATURE_OPTIONS = [
  'Estimates',
  'Proposals',
  'Schedule/Gantt',
  'Logic network',
  'Project dashboard',
  'RFIs',
  'Change orders',
  'Field tracking',
  'Other',
] as const;
