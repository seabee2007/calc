import { supabase } from '../lib/supabase';
import { CutListItem } from './reinforcement';

export interface SaveReinforcementOptions {
  projectId?: string;  // Add project ID for integration
  projectName: string;
  calc: {
    length_ft: number;
    width_ft: number;
    thickness_in: number;
    height_ft?: number;  // For columns
  };
  coverIn: number;
  type: 'rebar' | 'mesh' | 'fiber';
  
  // Expanded rebar data
  pickSize?: '#1' | '#2' | '#3' | '#4' | '#5' | '#6' | '#7' | '#8';
  spacingXIn?: number;  // X-direction spacing
  spacingYIn?: number;  // Y-direction spacing
  totalBarsX?: number;  // Total bars in X direction
  totalBarsY?: number;  // Total bars in Y direction
  totalBars?: number;   // Total bar count
  totalLinearFt?: number; // Total linear feet
  cutListX?: CutListItem[];
  cutListY?: CutListItem[];
  
  // Column data
  verticalBars?: number;
  tieSpacing?: number;
  
  // Fiber data (unchanged)
  fiberData?: {
    dose: number;
    totalLb: number;
    bags: number;
    fiberType: string;
  };
  
  // Mesh data (unchanged)  
  meshData?: {
    sheets: number;
    sheetSize: string;
  };
}

/**
 * Save reinforcement calculations to Supabase and integrate with project
 * Returns the created reinforcement set ID
 */
export async function saveReinforcement(opts: SaveReinforcementOptions): Promise<string> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Insert the main reinforcement set record with expanded data
  const { data: setRows, error: setErr } = await supabase
    .from('reinforcement_sets')
    .insert({
      user_id: user.id,
      project_id: opts.projectId,  // Link to project
      project_name: opts.projectName,
      length_ft: opts.calc.length_ft,
      width_ft: opts.calc.width_ft,
      thickness_in: opts.calc.thickness_in,
      height_ft: opts.calc.height_ft,
      cover_in: opts.coverIn,
      reinforcement_type: opts.type,
      
      // Add bar summary data
      bar_size: opts.pickSize,
      spacing_x_in: opts.spacingXIn,
      spacing_y_in: opts.spacingYIn,
      total_bars_x: opts.totalBarsX,
      total_bars_y: opts.totalBarsY,
      total_bars: opts.totalBars,
      total_linear_ft: opts.totalLinearFt,
      
      // Column specific
      vertical_bars: opts.verticalBars,
      tie_spacing: opts.tieSpacing,
      
      // Fiber data
      fiber_dose: opts.fiberData?.dose,
      fiber_total_lb: opts.fiberData?.totalLb,
      fiber_bags: opts.fiberData?.bags,
      fiber_type: opts.fiberData?.fiberType,
      
      // Mesh data
      mesh_sheets: opts.meshData?.sheets,
      mesh_sheet_size: opts.meshData?.sheetSize,
    })
    .select('id')
    .single();

  if (setErr) {
    console.error('Error inserting reinforcement set:', setErr);
    throw setErr;
  }

  const setId = setRows.id as string;

  // Only rebar mode needs cut-list rows
  if (opts.type === 'rebar' && opts.cutListX && opts.cutListY && opts.pickSize) {
    const cutListRows = [
      ...opts.cutListX.map(item => toRow(item, 'X', setId, opts.pickSize!)),
      ...opts.cutListY.map(item => toRow(item, 'Y', setId, opts.pickSize!))
    ];

    const { error: listErr } = await supabase
      .from('cut_list_items')
      .insert(cutListRows);

    if (listErr) {
      console.error('Error inserting cut list items:', listErr);
      throw listErr;
    }
  }

  return setId;
}

/**
 * Helper function to convert CutListItem to database row
 */
function toRow(item: CutListItem, direction: 'X' | 'Y', setId: string, barSize: string) {
  return {
    reinforcement_set_id: setId,
    direction,
    length_ft: item.lengthFt,
    quantity: item.qty,
    bar_size: barSize,
  };
}

/**
 * Load saved reinforcement sets for the current user
 */
export async function loadReinforcementSets() {
  const { data, error } = await supabase
    .from('reinforcement_sets')
    .select(`
      *,
      cut_list_items (*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading reinforcement sets:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a reinforcement set and all its cut list items
 */
export async function deleteReinforcementSet(setId: string) {
  const { error } = await supabase
    .from('reinforcement_sets')
    .delete()
    .eq('id', setId);

  if (error) {
    console.error('Error deleting reinforcement set:', error);
    throw error;
  }

  return true;
} 