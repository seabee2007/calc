import { supabase } from './supabase';
import { ProposalData } from '../types/proposal';
import type { ProposalStatus } from '../types/proposalTracking';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { computeProposalFinancials } from '../utils/proposalFinancials';
import { useTrackedProposalsStore } from '../store/trackedProposalsStore';

export type SavedProposal = TrackedProposalRow;

export function normalizeProposal(row: Record<string, unknown>): SavedProposal {
  return {
    ...(row as SavedProposal),
    project_id: (row.project_id as string | null) ?? null,
    status: (row.status as SavedProposal['status']) ?? 'draft',
    total_amount: Number(row.total_amount ?? 0),
    labor_cost: Number(row.labor_cost ?? 0),
    material_cost: Number(row.material_cost ?? 0),
    deposit_amount: Number(row.deposit_amount ?? 0),
    public_token: String(row.public_token ?? ''),
    sent_at: (row.sent_at as string | null) ?? null,
    viewed_at: (row.viewed_at as string | null) ?? null,
    opened_at: (row.opened_at as string | null) ?? null,
    accepted_at: (row.accepted_at as string | null) ?? null,
    declined_at: (row.declined_at as string | null) ?? null,
    deposit_paid_at: (row.deposit_paid_at as string | null) ?? null,
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
  };
}

export interface CreateProposalData {
  title: string;
  template_type: 'classic' | 'modern' | 'minimal';
  data: ProposalData;
  project_id?: string | null;
}

export interface UpdateProposalData {
  title?: string;
  template_type?: 'classic' | 'modern' | 'minimal';
  data?: ProposalData;
  project_id?: string | null;
  status?: ProposalStatus;
  total_amount?: number;
  labor_cost?: number;
  material_cost?: number;
  deposit_amount?: number;
}

export interface ImportedProposalFile {
  data: ProposalData;
  title?: string;
  template_type: 'classic' | 'modern' | 'minimal';
}

function normalizeImportedProposalData(raw: Record<string, unknown>): ProposalData {
  const pricing = Array.isArray(raw.pricing)
    ? (raw.pricing as ProposalData['pricing'])
    : [];
  const timeline = Array.isArray(raw.timeline)
    ? (raw.timeline as ProposalData['timeline'])
    : [];

  return {
    businessName: String(raw.businessName ?? ''),
    businessLogoUrl: raw.businessLogoUrl ? String(raw.businessLogoUrl) : undefined,
    businessAddress: raw.businessAddress ? String(raw.businessAddress) : undefined,
    businessAddressParts: raw.businessAddressParts as ProposalData['businessAddressParts'],
    businessPhone: raw.businessPhone ? String(raw.businessPhone) : undefined,
    businessEmail: raw.businessEmail ? String(raw.businessEmail) : undefined,
    businessLicenseNumber: raw.businessLicenseNumber
      ? String(raw.businessLicenseNumber)
      : undefined,
    businessSlogan: raw.businessSlogan ? String(raw.businessSlogan) : undefined,
    clientName: String(raw.clientName ?? ''),
    clientCompany: raw.clientCompany ? String(raw.clientCompany) : undefined,
    clientAddress: raw.clientAddress ? String(raw.clientAddress) : undefined,
    clientAddressParts: raw.clientAddressParts as ProposalData['clientAddressParts'],
    projectTitle: String(raw.projectTitle ?? raw.title ?? 'Imported Project'),
    date: String(raw.date ?? new Date().toLocaleDateString()),
    introduction: String(raw.introduction ?? ''),
    scope: String(raw.scope ?? ''),
    timeline,
    pricing,
    terms: String(raw.terms ?? ''),
    preparedBy: String(raw.preparedBy ?? ''),
    preparedByTitle: raw.preparedByTitle ? String(raw.preparedByTitle) : undefined,
  };
}

function parseTemplateType(value: unknown): 'classic' | 'modern' | 'minimal' {
  const v = String(value ?? 'classic');
  if (v === 'modern' || v === 'minimal') return v;
  return 'classic';
}

function withFinancials(
  data: ProposalData,
  extra?: Partial<UpdateProposalData>,
): Record<string, unknown> {
  const financials = computeProposalFinancials(data);
  return { ...extra, ...financials };
}

export class ProposalService {
  static async create(proposalData: CreateProposalData): Promise<SavedProposal> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to save proposals');
    }

    const financials = computeProposalFinancials(proposalData.data);

    const { data, error } = await supabase
      .from('proposals')
      .insert([
        {
          user_id: user.id,
          project_id: proposalData.project_id ?? null,
          title: proposalData.title,
          template_type: proposalData.template_type,
          data: proposalData.data,
          status: 'draft',
          ...financials,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving proposal:', error);
      throw new Error('Failed to save proposal');
    }

    const saved = normalizeProposal(data as Record<string, unknown>);
    useTrackedProposalsStore.getState().upsertProposal(saved);
    return saved;
  }

  static async update(id: string, updates: UpdateProposalData): Promise<SavedProposal> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to update proposals');
    }

    const payload: Record<string, unknown> = { ...updates };
    if (updates.data) {
      Object.assign(payload, withFinancials(updates.data));
    }

    const { data, error } = await supabase
      .from('proposals')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating proposal:', error);
      throw new Error('Failed to update proposal');
    }

    const saved = normalizeProposal(data as Record<string, unknown>);
    useTrackedProposalsStore.getState().upsertProposal(saved);
    return saved;
  }

  static async getAll(): Promise<SavedProposal[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to view proposals');
    }

    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching proposals:', error);
      throw new Error('Failed to fetch proposals');
    }

    return ((data as Record<string, unknown>[]) || []).map(normalizeProposal);
  }

  static async getById(id: string): Promise<SavedProposal> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to view proposals');
    }

    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching proposal:', error);
      throw new Error('Failed to fetch proposal');
    }

    return normalizeProposal(data as Record<string, unknown>);
  }

  static async delete(id: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to delete proposals');
    }

    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting proposal:', error);
      throw new Error('Failed to delete proposal');
    }

    useTrackedProposalsStore.getState().removeProposal(id);
  }

  static async duplicate(id: string, newTitle: string): Promise<SavedProposal> {
    const original = await this.getById(id);

    return this.create({
      title: newTitle,
      template_type: original.template_type,
      data: original.data,
    });
  }

  static exportAsJSON(proposal: SavedProposal): void {
    try {
      const dataStr = JSON.stringify(proposal, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const fileName = `${proposal.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_proposal.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch {
      throw new Error('Failed to download proposal file');
    }
  }

  static async importFromJSON(file: File): Promise<ImportedProposalFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content) as Record<string, unknown>;

          if (parsed.data && typeof parsed.data === 'object') {
            const data = normalizeImportedProposalData(
              parsed.data as Record<string, unknown>,
            );
            const title =
              typeof parsed.title === 'string' && parsed.title.trim()
                ? parsed.title.trim()
                : data.projectTitle || undefined;
            resolve({
              data,
              title,
              template_type: parseTemplateType(
                parsed.template_type ?? parsed.templateType,
              ),
            });
            return;
          }

          if (parsed.businessName || parsed.projectTitle) {
            const data = normalizeImportedProposalData(parsed);
            resolve({
              data,
              title: data.projectTitle || undefined,
              template_type: 'classic',
            });
            return;
          }

          reject(
            new Error(
              'Invalid proposal file. Use a JSON file exported from this app (⋮ → Export JSON).',
            ),
          );
        } catch {
          reject(new Error('Failed to parse proposal file — is it valid JSON?'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
