import { describe, expect, it, vi } from 'vitest';
import { resolveProposalSendDefaults } from '../resolveProposalSendDefaults';

vi.mock('../../services/projectClientEmailService', () => ({
  fetchProjectClientEmail: vi.fn().mockResolvedValue('project@client.com'),
}));

describe('resolveProposalSendDefaults', () => {
  it('prefers proposal recipient email over project client email', async () => {
    const email = await resolveProposalSendDefaults(
      {
        project_id: 'project-1',
        last_sent_to: null,
        data: {
          clientEmail: 'proposal@client.com',
        },
      },
      'project@client.com',
    );

    expect(email).toBe('proposal@client.com');
  });

  it('falls back to project client email when proposal recipient is blank', async () => {
    const email = await resolveProposalSendDefaults(
      {
        project_id: 'project-1',
        last_sent_to: null,
        data: {},
      },
      'project@client.com',
    );

    expect(email).toBe('project@client.com');
  });
});
