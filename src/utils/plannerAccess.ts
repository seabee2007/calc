import { supabase } from '../lib/supabase';
import { fetchAssignedProjects } from '../services/employeeService';

export interface AccessibleProject {
  id: string;
  name: string;
}

export async function fetchAccessibleProjects(
  userId: string,
  options: { isOwner: boolean; isEmployee: boolean },
): Promise<AccessibleProject[]> {
  if (options.isEmployee && !options.isOwner) {
    const rows = await fetchAssignedProjects(userId);
    return rows.map((p) => ({
      id: p.id as string,
      name: p.name as string,
    }));
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

export function projectNameMap(projects: AccessibleProject[]): Map<string, string> {
  return new Map(projects.map((p) => [p.id, p.name]));
}
