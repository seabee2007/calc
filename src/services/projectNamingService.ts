import { supabase } from '../lib/supabase';
import { resolveStateCode, type USAddress } from '../types/address';
import {
  buildProjectCodePrefix,
  buildProjectDisplayName,
  computeNextProjectNumber,
} from '../utils/projectNumbering';
import { summarizeProjectScope } from './projectScopeSummaryService';

export async function fetchProjectNamesForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('name')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => (row.name as string) ?? '').filter(Boolean);
}

export interface GenerateProjectNameInput {
  scopeDescription: string;
  jobsiteAddress: USAddress;
  userId: string;
  /** Extra names from in-memory store (may include unsynced rows). */
  additionalNames?: string[];
}

export interface GenerateProjectNameResult {
  name: string;
  prefix: string;
  projectNumber: number;
  scopeSummary: string;
}

export async function generateProjectName(
  input: GenerateProjectNameInput,
): Promise<GenerateProjectNameResult> {
  const stateCode = resolveStateCode(input.jobsiteAddress.state);
  if (!stateCode) {
    throw new Error(
      'Enter a valid US state on the jobsite address (e.g. GA or Georgia) to generate the project number.',
    );
  }

  const scope = input.scopeDescription.trim();
  if (!scope) {
    throw new Error('Enter the job scope / description before creating the project.');
  }

  const prefix = buildProjectCodePrefix(stateCode);
  const dbNames = await fetchProjectNamesForUser(input.userId);
  const allNames = [...dbNames, ...(input.additionalNames ?? [])];
  const projectNumber = computeNextProjectNumber(allNames, prefix);
  const scopeSummary = await summarizeProjectScope(scope);
  const name = buildProjectDisplayName(prefix, projectNumber, scopeSummary);

  return { name, prefix, projectNumber, scopeSummary };
}
