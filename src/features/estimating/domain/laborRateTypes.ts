export interface CompanyLaborRate {
  id: string;
  userId: string;
  roleKey: string;
  roleName: string;
  tradeCategory: string;
  hourlyRate: number;
  burdenPercent: number;
  fullyBurdenedRate: number;
  billingRate: number;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectLaborRate {
  id: string;
  projectId: string;
  companyLaborRateId?: string | null;
  roleKey: string;
  roleName: string;
  tradeCategory: string;
  hourlyRate: number;
  burdenPercent: number;
  fullyBurdenedRate: number;
  billingRate: number;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  isOverride: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type LaborPricingSource = 'project_rate' | 'manual' | 'unset';

export const STARTER_LABOR_ROLES: Pick<
  CompanyLaborRate,
  'roleKey' | 'roleName' | 'tradeCategory'
>[] = [
  { roleKey: 'laborer', roleName: 'Laborer', tradeCategory: 'General' },
  { roleKey: 'carpenter', roleName: 'Carpenter', tradeCategory: 'Carpentry' },
  { roleKey: 'concrete_finisher', roleName: 'Concrete Finisher', tradeCategory: 'Concrete' },
  { roleKey: 'foreman', roleName: 'Foreman', tradeCategory: 'General' },
  { roleKey: 'equipment_operator', roleName: 'Equipment Operator', tradeCategory: 'Equipment' },
  { roleKey: 'ironworker', roleName: 'Ironworker', tradeCategory: 'Structural' },
  { roleKey: 'plumber', roleName: 'Plumber', tradeCategory: 'Plumbing' },
  { roleKey: 'electrician', roleName: 'Electrician', tradeCategory: 'Electrical' },
  { roleKey: 'hvac_technician', roleName: 'HVAC Technician', tradeCategory: 'HVAC' },
  { roleKey: 'mason', roleName: 'Mason', tradeCategory: 'Masonry' },
  { roleKey: 'painter', roleName: 'Painter', tradeCategory: 'Finishes' },
  { roleKey: 'roofer', roleName: 'Roofer', tradeCategory: 'Roofing' },
  { roleKey: 'drywall_installer', roleName: 'Drywall Installer', tradeCategory: 'Finishes' },
  { roleKey: 'general_trade', roleName: 'General Trade', tradeCategory: 'General' },
];

export interface CompanyLaborRateInput {
  id?: string;
  userId: string;
  roleKey: string;
  roleName: string;
  tradeCategory?: string;
  hourlyRate?: number;
  burdenPercent?: number;
  billingRate?: number;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface ProjectLaborRateInput {
  id?: string;
  projectId: string;
  companyLaborRateId?: string | null;
  roleKey: string;
  roleName: string;
  tradeCategory?: string;
  hourlyRate?: number;
  burdenPercent?: number;
  billingRate?: number;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  isOverride?: boolean;
}
