/**
 * Database row types for the Construction activity schema (snake_case, mirrors migration).
 *
 * These are the raw shapes returned from Supabase — never exposed to the UI directly.
 * Domain types are in constructionActivityTypes.ts; mappers live in activityMappers.ts.
 */

// Re-export the result wrapper already used by the estimating feature.
export type { RepositoryResult } from './estimateDbTypes';

// ---------------------------------------------------------------------------
// Reference tables (global, read-only from client)
// ---------------------------------------------------------------------------

export interface ProductionRateRow {
  id: string;
  division_code: string;
  division_name: string;
  masterformat_code: string;
  work_element_line_number: string;
  description: string;
  unit: string;
  rate_type: 'labor_production' | 'equipment_production' | 'weight_measure' | 'material_quantity';
  man_hours_per_unit: number | null;
  equipment_hours_per_unit: number | null;
  quantity_per_unit: number | null;
  minimum_crew_size: number | null;
  crew_composition: Record<string, number> | null;
  source_manual: string;
  source_edition: string;
  source_division: string | null;
  source_figure: string | null;
  source_page: string | null;
  source_pdf_page: number | null;
  source_notes: string[];
  direct_labor_only: boolean;
  military_adjusted: boolean;
  civilian_conversion_multiplier: number | null;
  tags: string[];
  applicable_activity_types: string[];
  import_batch_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_active: boolean;
  superseded_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConstructionActivityTemplateRow {
  id: string;
  division_id: string;
  division_code: string;
  division_name: string;
  code: string;
  name: string;
  description: string | null;
  schedule_enabled: boolean;
  default_crew_size: number;
  default_hours_per_day: number;
  default_production_factor: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLineItemTemplateRow {
  id: string;
  construction_activity_template_id: string;
  production_rate_id: string;
  name: string;
  unit: string;
  default_man_hours_per_unit: number;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Project tables (user-scoped)
// ---------------------------------------------------------------------------

export interface ProjectConstructionActivityRow {
  id: string;
  project_id: string;
  estimate_id: string | null;
  /**
   * FK to construction_activity_templates(id).
   * NULL when the activity was created from the local TypeScript registry.
   * Only set when the activity was created from a real seeded DB template row.
   */
  activity_template_id: string | null;
  /**
   * Local TypeScript registry key (e.g. "slab-on-grade").
   * Stored here when activity_template_id is null.
   */
  source_template_key: string | null;
  division_code: string;
  division_name: string;
  activity_code: string;
  title: string;
  description: string | null;
  schedule_enabled: boolean;
  crew_size: number;
  hours_per_day: number;
  production_factor: number;
  calculated_man_hours: number;
  calculated_man_days: number;
  calculated_duration_days: number;
  duration_days_override: number | null;
  effective_duration_days: number;
  total_labor_cost: number;
  total_material_cost: number;
  total_equipment_cost: number;
  total_subcontract_cost: number;
  total_cost: number;
  warnings: string[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectActivityLineItemRow {
  id: string;
  project_activity_id: string;
  project_id: string;
  /** FK to production_rates(id). NULL for local/generated rate snapshots. */
  production_rate_id: string | null;
  source_production_rate_key: string | null;
  source_production_rate_label: string | null;
  source_figure: string | null;
  source_page: string | null;
  source_pdf_page: number | null;
  source_document_code: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  man_hours_per_unit: number;
  production_factor: number;
  calculated_man_hours: number;
  labor_cost: number;
  material_cost: number;
  equipment_cost: number;
  subcontract_cost: number;
  total_cost: number;
  sort_order: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Insert payloads (omit server-generated fields)
// ---------------------------------------------------------------------------

export type ProjectConstructionActivityInsert = Omit<
  ProjectConstructionActivityRow,
  'id' | 'created_at' | 'updated_at'
>;

export type ProjectActivityLineItemInsert = Omit<
  ProjectActivityLineItemRow,
  'id' | 'created_at'
>;
