import { supabase } from '../lib/supabase';
import type { ConcreteInspectionChecklist, InspectionItem } from '../types/fieldTools';

function mapInspection(row: Record<string, unknown>): ConcreteInspectionChecklist {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    projectId: (row.project_id as string) ?? null,
    projectName: (row.project_name as string) ?? '',
    projectAddress: (row.project_address as string) ?? '',
    inspectionDate: (row.inspection_date as string) ?? '',
    inspector: (row.inspector as string) ?? '',
    contractor: (row.contractor as string) ?? '',
    mixDesign: (row.mix_design as string) ?? '',
    placementType: (row.placement_type as string) ?? '',
    pourArea: (row.pour_area as string) ?? '',
    estimatedYards:
      row.estimated_yards != null && row.estimated_yards !== ''
        ? String(row.estimated_yards)
        : '',
    prePourItems: (row.pre_pour_items as InspectionItem[]) ?? [],
    duringPlacementItems: (row.during_placement_items as InspectionItem[]) ?? [],
    postPlacementItems: (row.post_placement_items as InspectionItem[]) ?? [],
    notes: (row.notes as string) ?? '',
    inspectorSignature: (row.inspector_signature as string) ?? '',
    contractorSignature: (row.contractor_signature as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toDbRow(checklist: ConcreteInspectionChecklist, userId: string) {
  const yards = checklist.estimatedYards.trim();
  return {
    user_id: userId,
    project_id: checklist.projectId || null,
    project_name: checklist.projectName || null,
    project_address: checklist.projectAddress || null,
    inspection_date: checklist.inspectionDate || null,
    inspector: checklist.inspector || null,
    contractor: checklist.contractor || null,
    mix_design: checklist.mixDesign || null,
    placement_type: checklist.placementType || null,
    pour_area: checklist.pourArea || null,
    estimated_yards: yards ? Number.parseFloat(yards) : null,
    pre_pour_items: checklist.prePourItems ?? [],
    during_placement_items: checklist.duringPlacementItems ?? [],
    post_placement_items: checklist.postPlacementItems ?? [],
    notes: checklist.notes || null,
    inspector_signature: checklist.inspectorSignature || null,
    contractor_signature: checklist.contractorSignature || null,
  };
}

export async function fetchConcreteInspection(id: string): Promise<ConcreteInspectionChecklist | null> {
  const { data, error } = await supabase
    .from('concrete_inspection_checklists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapInspection(data) : null;
}

export async function listConcreteInspections(
  userId: string,
  limit = 20,
): Promise<ConcreteInspectionChecklist[]> {
  const { data, error } = await supabase
    .from('concrete_inspection_checklists')
    .select('*')
    .eq('user_id', userId)
    .order('inspection_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapInspection);
}

export async function listConcreteInspectionsForProject(
  projectId: string,
  userId: string,
): Promise<ConcreteInspectionChecklist[]> {
  const { data, error } = await supabase
    .from('concrete_inspection_checklists')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('inspection_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInspection);
}

export async function upsertConcreteInspection(
  checklist: ConcreteInspectionChecklist,
  userId: string,
): Promise<ConcreteInspectionChecklist> {
  const payload = toDbRow(checklist, userId);

  if (checklist.id) {
    const { data, error } = await supabase
      .from('concrete_inspection_checklists')
      .update(payload)
      .eq('id', checklist.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return mapInspection(data);
  }

  const { data, error } = await supabase
    .from('concrete_inspection_checklists')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapInspection(data);
}

export async function deleteConcreteInspection(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('concrete_inspection_checklists')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
