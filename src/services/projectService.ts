import { supabase } from '../lib/supabase';
import type { Project, Calculation } from '../types';

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      calculations (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProject(project: Pick<Project, 'name' | 'description'>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  projectId: string,
  project: Partial<Pick<Project, 'name' | 'description'>>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(project)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

export async function addCalculation(
  projectId: string,
  calculation: Omit<Calculation, 'id' | 'createdAt'>
): Promise<Calculation> {
  const { data, error } = await supabase
    .from('calculations')
    .insert({
      ...calculation,
      project_id: projectId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCalculation(calculationId: string): Promise<void> {
  const { error } = await supabase
    .from('calculations')
    .delete()
    .eq('id', calculationId);

  if (error) throw error;
}