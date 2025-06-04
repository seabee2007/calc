import { supabase } from './supabase';
import { ProposalData } from '../types/proposal';

export interface SavedProposal {
  id: string;
  title: string;
  template_type: 'classic' | 'modern' | 'minimal';
  data: ProposalData;
  created_at: string;
  updated_at: string;
}

export interface CreateProposalData {
  title: string;
  template_type: 'classic' | 'modern' | 'minimal';
  data: ProposalData;
}

export interface UpdateProposalData {
  title?: string;
  template_type?: 'classic' | 'modern' | 'minimal';
  data?: ProposalData;
}

export class ProposalService {
  // Save a new proposal
  static async create(proposalData: CreateProposalData): Promise<SavedProposal> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to save proposals');
    }

    const { data, error } = await supabase
      .from('proposals')
      .insert([
        {
          user_id: user.id,
          title: proposalData.title,
          template_type: proposalData.template_type,
          data: proposalData.data,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error saving proposal:', error);
      throw new Error('Failed to save proposal');
    }

    return data;
  }

  // Update an existing proposal
  static async update(id: string, updates: UpdateProposalData): Promise<SavedProposal> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to update proposals');
    }

    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating proposal:', error);
      throw new Error('Failed to update proposal');
    }

    return data;
  }

  // Get all proposals for the current user
  static async getAll(): Promise<SavedProposal[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
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

    return data || [];
  }

  // Get a specific proposal by ID
  static async getById(id: string): Promise<SavedProposal> {
    const { data: { user } } = await supabase.auth.getUser();
    
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

    return data;
  }

  // Delete a proposal
  static async delete(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
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

  // Duplicate a proposal
  static async duplicate(id: string, newTitle: string): Promise<SavedProposal> {
    const original = await this.getById(id);
    
    return this.create({
      title: newTitle,
      template_type: original.template_type,
      data: original.data,
    });
  }

  // Export proposal as JSON
  static exportAsJSON(proposal: SavedProposal): void {
    try {
      console.log('Starting export for proposal:', proposal.title);
      
      const dataStr = JSON.stringify(proposal, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      console.log('Created blob URL:', url);
      
      const fileName = `${proposal.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_proposal.json`;
      console.log('Download filename:', fileName);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // Add to document, click, and remove
      document.body.appendChild(link);
      console.log('Triggering download...');
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('Download cleanup completed');
      }, 100);
      
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to download proposal file');
    }
  }

  // Import proposal from JSON file
  static async importFromJSON(file: File): Promise<ProposalData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const proposal = JSON.parse(content);
          
          // Validate that it has the required structure
          if (proposal.data && typeof proposal.data === 'object') {
            resolve(proposal.data);
          } else if (proposal.businessName || proposal.projectTitle) {
            // Direct proposal data
            resolve(proposal);
          } else {
            reject(new Error('Invalid proposal file format'));
          }
        } catch (error) {
          reject(new Error('Failed to parse proposal file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
} 