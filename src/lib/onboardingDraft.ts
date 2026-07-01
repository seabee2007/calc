/**
 * Persistent onboarding draft storage.
 *
 * Keyed by userId so multiple accounts on the same browser never collide.
 * The draft is the source of truth for in-progress onboarding; it is cleared
 * only after a successful server-side completion (onboardingCompletedAt set).
 */

export type OnboardingStepType =
  | 'welcome'
  | 'company-name'
  | 'email'
  | 'phone'
  | 'address'
  | 'license'
  | 'motto'
  | 'measurement-system'
  | 'theme';

export interface OnboardingDraftValues {
  companyName?: string;
  email?: string;
  phone?: string;
  /** Pipe-encoded address: "street|street2|city|state|zip" */
  address?: string;
  licenseNumber?: string;
  motto?: string;
  measurementSystem?: 'imperial' | 'metric';
  theme?: string;
}

export interface OnboardingDraft {
  schemaVersion: 1;
  userId: string;
  currentStep: OnboardingStepType;
  completedSteps: OnboardingStepType[];
  values: OnboardingDraftValues;
  updatedAt: string;
}

const SCHEMA_VERSION = 1 as const;

const VALID_STEPS: readonly OnboardingStepType[] = [
  'welcome',
  'company-name',
  'email',
  'phone',
  'address',
  'license',
  'motto',
  'measurement-system',
  'theme',
];

export function getOnboardingDraftKey(userId: string): string {
  return `arden:onboarding:draft:${userId}`;
}

export function isValidOnboardingStep(value: unknown): value is OnboardingStepType {
  return VALID_STEPS.includes(value as OnboardingStepType);
}

export function getOnboardingDraft(userId: string): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(getOnboardingDraftKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.schemaVersion !== SCHEMA_VERSION ||
      parsed.userId !== userId ||
      !isValidOnboardingStep(parsed.currentStep)
    ) {
      return null;
    }

    return parsed as OnboardingDraft;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(userId: string, draft: Omit<OnboardingDraft, 'updatedAt'>): void {
  try {
    const full: OnboardingDraft = { ...draft, updatedAt: new Date().toISOString() };
    localStorage.setItem(getOnboardingDraftKey(userId), JSON.stringify(full));
  } catch {
    // Storage quota exceeded or private-browsing restriction — silently ignore.
    // The draft is best-effort; the app still functions without it.
  }
}

export function clearOnboardingDraft(userId: string): void {
  try {
    localStorage.removeItem(getOnboardingDraftKey(userId));
  } catch {
    // ignore
  }
}

/**
 * Merge server-loaded defaults with a restored draft.
 * Draft values win for any field the user has explicitly touched;
 * server defaults fill in fields the user hasn't typed yet.
 */
export function mergeOnboardingDraftValues(
  serverValues: Required<OnboardingDraftValues>,
  draftValues: OnboardingDraftValues,
): Required<OnboardingDraftValues> {
  return {
    companyName: draftValues.companyName ?? serverValues.companyName,
    email: draftValues.email ?? serverValues.email,
    phone: draftValues.phone ?? serverValues.phone,
    address: draftValues.address ?? serverValues.address,
    licenseNumber: draftValues.licenseNumber ?? serverValues.licenseNumber,
    motto: draftValues.motto ?? serverValues.motto,
    measurementSystem: draftValues.measurementSystem ?? serverValues.measurementSystem,
    theme: draftValues.theme ?? serverValues.theme,
  };
}
