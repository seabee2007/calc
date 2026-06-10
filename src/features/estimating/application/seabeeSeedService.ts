/**
 * Seed service: pushes TypeScript production-rate and activity-template seeds
 * to the Supabase reference tables.
 *
 * Only called from the /dev/seabee-preview page (DEV builds only) or from a
 * CLI script. Never called automatically on app startup.
 *
 * Uses UPSERT (ON CONFLICT DO UPDATE) so re-running is safe.
 */
import { supabase } from '../../../lib/supabase';
import type { ProductionRate, ConstructionActivityTemplate, ActivityLineItemTemplate } from '../domain/seabeeActivityTypes';
import type { RepositoryResult } from '../infrastructure/estimateDbTypes';
import { SEABEE_DIVISION_03_CONCRETE_SEED } from '../data/seabeeConcreteSeeds';
import { SEABEE_DIVISION_31_EARTHWORK_SEED } from '../data/seabeeEarthworkSeeds';

function success<T>(data: T): RepositoryResult<T> {
  return { data, error: null };
}
function failure<T>(error: unknown): RepositoryResult<T> {
  const msg = error instanceof Error ? error.message : String(error);
  return { data: null, error: msg };
}

// ---------------------------------------------------------------------------
// Batch import table
// ---------------------------------------------------------------------------

async function upsertImportBatch(id: string, manual: string, edition: string) {
  return supabase.from('production_rate_import_batches').upsert(
    { id, source_manual: manual, source_edition: edition },
    { onConflict: 'id' },
  );
}

// ---------------------------------------------------------------------------
// Production rates
// ---------------------------------------------------------------------------

function rateToRow(rate: ProductionRate): Record<string, unknown> {
  return {
    id: rate.id,
    division_code: rate.divisionCode,
    division_name: rate.divisionName,
    masterformat_code: rate.masterFormatCode,
    work_element_line_number: rate.workElementLineNumber,
    description: rate.description,
    unit: rate.unit,
    rate_type: rate.rateType,
    man_hours_per_unit: rate.manHoursPerUnit ?? null,
    equipment_hours_per_unit: rate.equipmentHoursPerUnit ?? null,
    quantity_per_unit: rate.quantityPerUnit ?? null,
    minimum_crew_size: rate.minimumCrewSize ?? null,
    crew_composition: rate.crewComposition ?? null,
    source_manual: rate.sourceManual,
    source_edition: rate.sourceEdition,
    source_division: rate.sourceDivision ?? null,
    source_figure: rate.sourceFigure ?? null,
    source_page: rate.sourcePage ?? null,
    source_pdf_page: rate.sourcePdfPage ?? null,
    source_notes: rate.sourceNotes ?? [],
    direct_labor_only: rate.directLaborOnly,
    military_adjusted: rate.militaryAdjusted,
    civilian_conversion_multiplier: rate.civilianConversionMultiplier ?? null,
    tags: rate.tags,
    applicable_activity_types: rate.applicableActivityTypes,
    import_batch_id: rate.importBatchId || null,
    reviewed_by: rate.reviewedBy ?? null,
    reviewed_at: rate.reviewedAt ?? null,
    is_active: rate.isActive,
    superseded_by_id: rate.supersededById ?? null,
  };
}

export async function seedProductionRates(
  rates: readonly ProductionRate[],
): Promise<RepositoryResult<number>> {
  try {
    const rows = rates.map(rateToRow);
    const { error } = await supabase
      .from('production_rates')
      .upsert(rows, { onConflict: 'id' });
    if (error) return failure(error.message);
    return success(rows.length);
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Activity templates
// ---------------------------------------------------------------------------

function templateToRow(t: ConstructionActivityTemplate): Record<string, unknown> {
  return {
    id: t.id,
    division_id: t.divisionId,
    division_code: t.divisionId.replace('div-', '').split('-')[0] ?? t.divisionId,
    division_name: t.divisionId,
    code: t.code,
    name: t.name,
    description: t.description ?? null,
    schedule_enabled: t.scheduleEnabled,
    default_crew_size: t.defaultCrewSize,
    default_hours_per_day: t.defaultHoursPerDay,
    default_production_factor: t.defaultProductionFactor ?? 1,
    tags: [],
    is_active: true,
  };
}

function lineItemTemplateToRow(
  t: ActivityLineItemTemplate,
  divisionCode: string,
): Record<string, unknown> {
  void divisionCode;
  return {
    id: t.id,
    construction_activity_template_id: t.constructionActivityTemplateId,
    production_rate_id: t.productionRateId,
    name: t.name,
    unit: t.unit,
    default_man_hours_per_unit: t.defaultManHoursPerUnit,
    sort_order: t.sortOrder ?? 0,
    is_required: true,
    is_active: true,
  };
}

export async function seedActivityTemplates(
  templates: readonly ConstructionActivityTemplate[],
  lineItemGroups: Record<string, readonly ActivityLineItemTemplate[]>,
  divisionCode: string,
): Promise<RepositoryResult<{ templates: number; lineItems: number }>> {
  try {
    const templateRows = templates.map(templateToRow);
    const { error: tErr } = await supabase
      .from('construction_activity_templates')
      .upsert(templateRows, { onConflict: 'id' });
    if (tErr) return failure(tErr.message);

    const allLineItems = Object.values(lineItemGroups).flat();
    const lineItemRows = allLineItems.map((li) => lineItemTemplateToRow(li, divisionCode));
    const { error: liErr } = await supabase
      .from('activity_line_item_templates')
      .upsert(lineItemRows, { onConflict: 'id' });
    if (liErr) return failure(liErr.message);

    return success({ templates: templateRows.length, lineItems: lineItemRows.length });
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: seed all currently loaded divisions at once
// ---------------------------------------------------------------------------

export interface SeedAllResult {
  div03: { rates: number; templates: number; lineItems: number } | null;
  div31: { rates: number; templates: number; lineItems: number } | null;
  errors: string[];
}

export async function seedAllDivisions(): Promise<SeedAllResult> {
  const errors: string[] = [];
  let div03: SeedAllResult['div03'] = null;
  let div31: SeedAllResult['div31'] = null;

  // Batch records
  await upsertImportBatch('batch-div03-2026-06', 'NTRP 4-04.2.3/TM 3-34.41/MCRP 3-40D.12', 'OCT 2021 Change 1 OCT 2022');
  await upsertImportBatch('batch-div31-2026-06', 'NTRP 4-04.2.3/TM 3-34.41/MCRP 3-40D.12', 'OCT 2021 Change 1 OCT 2022');

  // Division 03
  const r03 = await seedProductionRates(SEABEE_DIVISION_03_CONCRETE_SEED.productionRates);
  if (r03.error) {
    errors.push(`Div 03 rates: ${r03.error}`);
  } else {
    const t03 = await seedActivityTemplates(
      SEABEE_DIVISION_03_CONCRETE_SEED.activities,
      SEABEE_DIVISION_03_CONCRETE_SEED.lineItemGroups,
      '03',
    );
    if (t03.error) {
      errors.push(`Div 03 templates: ${t03.error}`);
    } else {
      div03 = { rates: r03.data ?? 0, ...(t03.data ?? { templates: 0, lineItems: 0 }) };
    }
  }

  // Division 31
  const r31 = await seedProductionRates(SEABEE_DIVISION_31_EARTHWORK_SEED.productionRates);
  if (r31.error) {
    errors.push(`Div 31 rates: ${r31.error}`);
  } else {
    const allActivities = Object.values(SEABEE_DIVISION_31_EARTHWORK_SEED).filter(
      (v): v is ConstructionActivityTemplate =>
        typeof v === 'object' && v !== null && 'code' in v && 'scheduleEnabled' in v,
    );
    const t31 = await seedActivityTemplates(
      allActivities,
      SEABEE_DIVISION_31_EARTHWORK_SEED.lineItemGroups,
      '31',
    );
    if (t31.error) {
      errors.push(`Div 31 templates: ${t31.error}`);
    } else {
      div31 = { rates: r31.data ?? 0, ...(t31.data ?? { templates: 0, lineItems: 0 }) };
    }
  }

  return { div03, div31, errors };
}
