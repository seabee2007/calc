import { supabase } from './supabase';
import { ProposalData } from '../types/proposal';
import type { ProposalStatus } from '../types/proposalTracking';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { computeProposalFinancials } from '../utils/proposalFinancials';

export type SavedProposal = TrackedProposalRow;

export interface CreateProposalData {
  title: string;
  template_type: 'classic' | 'modern' | 'minimal';
  data: ProposalData;
}

export interface UpdateProposalData {
  title?: string;
  template_type?: 'classic' | 'modern' | 'minimal';
  data?: ProposalData;
  status?: ProposalStatus;
  total_amount?: number;
  labor_cost?: number;
  material_cost?: number;
  deposit_amount?: number;
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

    return data as SavedProposal;
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

    return data as SavedProposal;
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

    return (data as SavedProposal[]) || [];
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

    return data as SavedProposal;
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

  static async importFromJSON(file: File): Promise<ProposalData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const proposal = JSON.parse(content);

          if (proposal.data && typeof proposal.data === 'object') {
            resolve(proposal.data);
          } else if (proposal.businessName || proposal.projectTitle) {
            resolve(proposal);
          } else {
            reject(new Error('Invalid proposal file format'));
          }
        } catch {
          reject(new Error('Failed to parse proposal file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
