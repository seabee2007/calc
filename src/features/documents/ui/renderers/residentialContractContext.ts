import { format } from 'date-fns';
import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import { formatUSAddress, type USAddress } from '../../../../types/address';
import { formatCurrencyDisplay } from '../../../../utils/currencyInput';
import { displayValue, isMissingDisplayValue } from '../previewDisplay';

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

const PRICE_MODEL_LABELS: Record<string, string> = {
  fixed_price: 'Fixed Price',
  time_and_materials: 'Time & Materials',
  cost_plus: 'Cost Plus',
};

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return undefined;
}

function structuredAddress(
  answers: Record<string, unknown>,
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

function formatMoney(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatCurrencyDisplay(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) return formatCurrencyDisplay(n);
  }
  return undefined;
}

export interface ResidentialContractDisplayContext {
  documentDate: string;
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    licenseNumber?: string;
    logoUrl?: string | null;
  };
  parties: Array<{ label: string; value: string }>;
  summary: Array<{ label: string; value: string }>;
  signatures: {
    contractorName: string | null;
    ownerName: string | null;
  };
}

export function buildResidentialContractDisplayContext(input: {
  answers: Record<string, unknown>;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  selectedProject: Project | null;
}): ResidentialContractDisplayContext {
  const { answers, companySettings, selectedProject } = input;

  const contractorName =
    str(answers.contractorLegalName) ?? companySettings.companyName?.trim() ?? undefined;
  const contractorAddress =
    structuredAddress(answers, 'contractorAddress') ?? companySettings.address?.trim();
  const ownerName =
    str(answers.ownerFullName) ?? selectedProject?.clientInfo?.clientName?.trim();
  const propertyAddress =
    structuredAddress(answers, 'propertyAddress') ??
    (selectedProject?.jobsiteAddress
      ? formatUSAddress(selectedProject.jobsiteAddress)
      : undefined);
  const projectTypeRaw = str(answers.projectType);
  const projectType = projectTypeRaw
    ? PROJECT_TYPE_LABELS[projectTypeRaw] ?? projectTypeRaw
    : undefined;
  const priceModelRaw = str(answers.priceModel);
  const priceModel = priceModelRaw
    ? PRICE_MODEL_LABELS[priceModelRaw] ?? priceModelRaw
    : undefined;
  const contractPrice = formatMoney(answers.contractPrice) ?? formatMoney(answers.estimatedTotal);
  const depositAmount = formatMoney(answers.depositAmount);
  const depositPercent = str(answers.depositPercent);
  const depositRequired = answers.depositRequired === true;
  const depositLine =
    depositRequired && (depositAmount || depositPercent)
      ? [depositAmount, depositPercent ? `${depositPercent}%` : null].filter(Boolean).join(' · ')
      : depositRequired
        ? 'Required — amount not specified'
        : undefined;
  const paymentSchedule = str(answers.progressPayments);

  const parties: Array<{ label: string; value: string }> = [];
  if (contractorName) parties.push({ label: 'Contractor', value: contractorName });
  if (contractorAddress) parties.push({ label: 'Contractor address', value: contractorAddress });
  if (ownerName) parties.push({ label: 'Owner / Client', value: ownerName });
  if (propertyAddress) parties.push({ label: 'Project property', value: propertyAddress });
  if (projectType) parties.push({ label: 'Project type', value: projectType });
  if (selectedProject?.name?.trim()) {
    parties.push({ label: 'Project', value: selectedProject.name.trim() });
  }

  const summary: Array<{ label: string; value: string }> = [];
  if (priceModel) summary.push({ label: 'Pricing model', value: priceModel });
  if (contractPrice) summary.push({ label: 'Contract price', value: contractPrice });
  if (paymentSchedule) summary.push({ label: 'Payment schedule', value: paymentSchedule });
  if (depositLine) summary.push({ label: 'Deposit', value: depositLine });
  const startDate = str(answers.startDate);
  const completionDate = str(answers.completionDate);
  if (startDate) summary.push({ label: 'Estimated start', value: startDate });
  if (completionDate) summary.push({ label: 'Estimated completion', value: completionDate });

  return {
    documentDate: format(new Date(), 'MMMM d, yyyy'),
    company: {
      name: companySettings.companyName?.trim() || contractorName || 'Contractor',
      address: companySettings.address?.trim() || contractorAddress,
      phone: companySettings.phone?.trim() || str(answers.contractorPhone),
      email: companySettings.email?.trim() || str(answers.contractorEmail),
      licenseNumber:
        companySettings.licenseNumber?.trim() || str(answers.contractorLicenseNumber),
      logoUrl: companySettings.logoUrl ?? companySettings.logo ?? null,
    },
    parties,
    summary,
    signatures: {
      contractorName: contractorName ?? null,
      ownerName: ownerName ?? null,
    },
  };
}

export function filterVisibleRows(rows: Array<{ label: string; value: string }>) {
  return rows.filter((row) => !isMissingDisplayValue(row.value));
}

export { displayValue, isMissingDisplayValue };
