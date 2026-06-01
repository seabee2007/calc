import type {
  DocumentInput,
  DocumentRecommendationDecision,
  QuestionnaireMode,
} from '../index';
import { formatUSAddress, type USAddress } from '../../../types/address';

/**
 * UI -> engine input mapping. This is input collection only (no document
 * logic): it reshapes the flat questionnaire answers the form collects into the
 * structured `DocumentInput` the engine expects.
 *
 * Important: nested fact object keys must not collide with flat answer keys the
 * risk/recommendation engines read (e.g. `hoa`), because `facts` takes
 * precedence over `answers`. Collision-prone values are intentionally left as
 * flat answers and surface in clause bodies as fill-in markers.
 */

export type ContractAnswers = Record<string, unknown>;

export interface ContractCompanyInfo {
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  remodel: 'Remodel',
  repair: 'Repair',
  concrete: 'Concrete',
  roofing: 'Roofing',
  adu: 'ADU',
  deck: 'Deck',
  fence: 'Fence',
  new_construction: 'New Construction',
  insurance_restoration: 'Insurance Restoration',
};

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function structuredAddress(
  answers: ContractAnswers,
  prefix: 'ownerMailingAddress' | 'propertyAddress' | 'contractorAddress',
): string | undefined {
  const addr: Partial<USAddress> = {
    street: str(answers[`${prefix}Street`]) ?? '',
    street2: str(answers[`${prefix}Street2`]) ?? '',
    city: str(answers[`${prefix}City`]) ?? '',
    state: str(answers[`${prefix}State`]) ?? '',
    zip: str(answers[`${prefix}Zip`]) ?? '',
  };
  const formatted = formatUSAddress(addr);
  return formatted || str(answers[prefix]);
}

export interface BuildDocumentInputOptions {
  company?: ContractCompanyInfo;
  packKey?: string;
  mode?: QuestionnaireMode;
  recommendationDecisions?: DocumentRecommendationDecision[];
}

export function buildDocumentInput(
  answers: ContractAnswers,
  acceptedAddendumKeys: string[],
  options: BuildDocumentInputOptions = {},
): DocumentInput {
  const {
    company = {},
    packKey = 'GENERIC_RESIDENTIAL',
    mode,
    recommendationDecisions,
  } = options;
  const projectTypeRaw = str(answers.projectType);
  const projectTypeLabel = projectTypeRaw
    ? PROJECT_TYPE_LABELS[projectTypeRaw] ?? projectTypeRaw
    : undefined;

  const facts: Record<string, unknown> = {
    acceptedAddendumKeys,
    mode,
    recommendationDecisions: recommendationDecisions ?? [],
    contractor: {
      legalName: str(answers.contractorLegalName) ?? company.legalName,
      address: structuredAddress(answers, 'contractorAddress') ?? company.address,
      phone: str(answers.contractorPhone) ?? company.phone,
      email: str(answers.contractorEmail) ?? company.email,
      licenseNumber: str(answers.contractorLicenseNumber) ?? company.licenseNumber,
    },
    owner: {
      fullName: str(answers.ownerFullName),
      mailingAddress: structuredAddress(answers, 'ownerMailingAddress'),
      phone: str(answers.ownerPhone),
      email: str(answers.ownerEmail),
    },
    property: { address: structuredAddress(answers, 'propertyAddress') },
    project: {
      name: str(answers.projectName) ?? str(answers.propertyAddress),
      projectType: projectTypeLabel,
      scopeSummary: str(answers.scopeSummary),
      scopeItems: [],
      exclusions: str(answers.exclusionsSummary)
        ? [{ description: str(answers.exclusionsSummary) }]
        : [],
      contractDocuments: [],
    },
    pricing: {
      contractPrice: answers.contractPrice,
      estimatedTotal: answers.estimatedTotal,
    },
    deposit: {
      amount: answers.depositAmount,
      percent: answers.depositPercent,
      dueType: str(answers.depositDueType),
      dueDate:
        answers.depositDueType === 'upon_signing'
          ? 'Due upon signing'
          : str(answers.depositDueDate),
    },
    payment: {
      schedule: [],
      progressMilestones: [],
      retainagePercent: answers.retainagePercent,
      retainageReleaseDays: answers.retainageReleaseDays,
      lateFeeDescription: str(answers.lateFeeDescription),
    },
    schedule: {
      startDate: str(answers.startDate),
      completionDate: str(answers.completionDate),
      workHours: str(answers.workHours),
    },
    permits: { responsibleParty: str(answers.permitsResponsibleParty), items: [] },
    warranty: { months: answers.workmanshipWarrantyMonths },
    dispute: { method: str(answers.disputeMethod), venue: str(answers.disputeVenue) },
    insurance: {
      claimNumber: str(answers.insuranceClaimNumber),
      carrier: str(answers.insuranceCarrier),
      adjuster: str(answers.insuranceAdjuster),
    },
    concrete: {
      mixDesign: str(answers.concreteMixDesign),
      psi: answers.concretePsi,
      slump: answers.concreteSlump,
      air: str(answers.concreteAir),
      reinforcement: str(answers.concreteReinforcement),
      fiber: answers.concreteReinforcement === 'fiber' ? 'Yes' : undefined,
      rebar: answers.concreteReinforcement === 'rebar' ? 'Yes' : undefined,
      mesh: answers.concreteReinforcement === 'mesh' ? 'Yes' : undefined,
      jointing: str(answers.concreteJointing),
      finish: str(answers.concreteFinish),
      curing: str(answers.concreteCuring),
    },
    readyMix: {
      plant: str(answers.readyMixPlant),
      mix: str(answers.readyMixMix),
      yards: answers.readyMixYards,
      deliveryDate: str(answers.readyMixDeliveryDate),
      pumpRequired:
        answers.readyMixPumpRequired === true
          ? 'Yes'
          : answers.readyMixPumpRequired === false
            ? 'No'
            : undefined,
    },
    acceptance: {
      flatness: str(answers.acceptanceFlatness),
      levelness: str(answers.acceptanceLevelness),
      finishType: str(answers.concreteFinish),
      jointing: str(answers.concreteJointing),
      tolerance: str(answers.acceptanceTolerance),
    },
  };

  return {
    documentType: 'residential_contract',
    packKey,
    answers,
    facts,
  };
}
