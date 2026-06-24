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
  'roleKey' | 'roleName' | 'tradeCategory' | 'hourlyRate' | 'burdenPercent' | 'billingRate'
>[] = [
  {
    roleKey: 'foreman',
    roleName: 'Foreman / Supervisor',
    tradeCategory: 'Supervision',
    hourlyRate: 39.05,
    burdenPercent: 30,
    billingRate: 76.15,
  },
  {
    roleKey: 'electrician',
    roleName: 'Electrician',
    tradeCategory: 'Electrical',
    hourlyRate: 32.44,
    burdenPercent: 30,
    billingRate: 63.26,
  },
  {
    roleKey: 'plumber',
    roleName: 'Plumber',
    tradeCategory: 'Plumbing',
    hourlyRate: 31.81,
    burdenPercent: 30,
    billingRate: 62.03,
  },
  {
    roleKey: 'equipment_operator',
    roleName: 'Equipment Operator',
    tradeCategory: 'Equipment',
    hourlyRate: 29.15,
    burdenPercent: 30,
    billingRate: 56.84,
  },
  {
    roleKey: 'carpenter',
    roleName: 'Carpenter',
    tradeCategory: 'Carpentry',
    hourlyRate: 27.99,
    burdenPercent: 30,
    billingRate: 54.58,
  },
  {
    roleKey: 'mason',
    roleName: 'Mason / Brickmason',
    tradeCategory: 'Masonry',
    hourlyRate: 27.91,
    burdenPercent: 30,
    billingRate: 54.42,
  },
  {
    roleKey: 'drywall_installer',
    roleName: 'Drywall Installer',
    tradeCategory: 'Drywall',
    hourlyRate: 26.86,
    burdenPercent: 30,
    billingRate: 52.38,
  },
  {
    roleKey: 'hvac_technician',
    roleName: 'HVAC Technician',
    tradeCategory: 'HVAC',
    hourlyRate: 26.54,
    burdenPercent: 30,
    billingRate: 51.75,
  },
  {
    roleKey: 'concrete_finisher',
    roleName: 'Concrete Finisher',
    tradeCategory: 'Concrete',
    hourlyRate: 25.68,
    burdenPercent: 30,
    billingRate: 50.08,
  },
  {
    roleKey: 'roofer',
    roleName: 'Roofer',
    tradeCategory: 'Roofing',
    hourlyRate: 25.12,
    burdenPercent: 30,
    billingRate: 48.98,
  },
  {
    roleKey: 'painter',
    roleName: 'Painter',
    tradeCategory: 'Painting',
    hourlyRate: 23.94,
    burdenPercent: 30,
    billingRate: 46.68,
  },
  {
    roleKey: 'laborer',
    roleName: 'Laborer (General)',
    tradeCategory: 'General',
    hourlyRate: 22.29,
    burdenPercent: 30,
    billingRate: 43.47,
  },
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
