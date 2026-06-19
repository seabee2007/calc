import type { EstimateType } from '../domain/estimateTypes';
import type { ProjectActivityLineItem, ProjectConstructionActivity } from '../domain/constructionActivityTypes';

export const ESTIMATE_EXCEL_SCHEMA_VERSION = 'arden-estimate-template-v1' as const;

export type EstimateExcelSchemaVersion = typeof ESTIMATE_EXCEL_SCHEMA_VERSION;

export type ActivityExcelEstimateType = Extract<EstimateType, 'detailed' | 'bid'>;

export type ImportRowStatus =
  | 'valid'
  | 'warning'
  | 'blocked'
  | 'duplicate'
  | 'unpriced';

export interface EstimateExcelColumnDef {
  key: string;
  label: string;
  required: boolean;
  columnWidth?: number;
}

export interface EstimateExcelWorkbookInfo {
  schemaVersion: string;
  estimateType: ActivityExcelEstimateType | null;
  templateGeneratedAt: string | null;
  projectName: string | null;
}

export interface EstimateExcelRawRow {
  rowNumber: number;
  values: Record<string, string | number | boolean | null>;
}

export interface EstimateExcelLineRow {
  rowNumber: number;
  divisionCode: string;
  divisionName: string;
  activityCode: string | null;
  activityName: string;
  lineItemDescription: string;
  quantity: number | null;
  unit: string | null;
  productionRateId: string | null;
  manHoursPerUnit: number | null;
  crewSize: number | null;
  laborRole: string | null;
  materialUnitCost: number | null;
  equipmentUnitCost: number | null;
  subcontractorUnitCost: number | null;
  scheduleEnabled: boolean;
  notes: string | null;
  status: ImportRowStatus;
  messages: string[];
}

export interface ParsedActivityGroup {
  groupKey: string;
  divisionCode: string;
  divisionName: string;
  activityCode: string | null;
  activityName: string;
  crewSize: number;
  scheduleEnabled: boolean;
  lineRows: EstimateExcelLineRow[];
  importable: boolean;
}

export interface ActivityExcelImportPreview {
  workbookInfo: EstimateExcelWorkbookInfo;
  activityCount: number;
  lineItemCount: number;
  validCount: number;
  warningCount: number;
  blockedCount: number;
  duplicateCount: number;
  unpricedCount: number;
  groups: ParsedActivityGroup[];
  rowResults: EstimateExcelLineRow[];
  warnings: string[];
  errors: string[];
}

export interface ActivityExcelParseResult {
  preview: ActivityExcelImportPreview | null;
  importableGroups: ParsedActivityGroup[];
  errors: string[];
}

export type ActivityExcelImportMode = 'add' | 'replace';

export interface ActivityExcelImportApplyInput {
  mode: ActivityExcelImportMode;
  groups: ParsedActivityGroup[];
  projectId: string;
  estimateId: string;
  projectLaborRates: readonly import('../domain/laborRateTypes').ProjectLaborRate[];
  existingActivities: readonly ProjectConstructionActivity[];
  existingLineItemsByActivityId: ReadonlyMap<string, readonly ProjectActivityLineItem[]>;
}

export interface ActivityExcelImportApplyResult {
  importedActivityCount: number;
  importedLineItemCount: number;
  skippedCount: number;
  warnings: string[];
  error: string | null;
}

export interface ActivityExcelExportInput {
  estimateType: ActivityExcelEstimateType;
  projectName: string;
  activities: readonly ProjectConstructionActivity[];
  lineItemsByActivityId: ReadonlyMap<string, readonly ProjectActivityLineItem[]>;
  exportNotes?: string[];
}
