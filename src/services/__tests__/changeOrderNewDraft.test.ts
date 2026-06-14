import { describe, expect, it, vi } from 'vitest';
import { resolveChangeOrderNewDraft } from '../changeOrderService';
import { fetchAdjustmentById } from '../fieldAdjustmentService';
import { fetchRfiById } from '../rfiService';

vi.mock('../fieldAdjustmentService', () => ({
  fetchAdjustmentById: vi.fn(),
  linkFarToChangeOrder: vi.fn(),
}));

vi.mock('../rfiService', () => ({
  fetchRfiById: vi.fn(),
}));

describe('resolveChangeOrderNewDraft', () => {
  it('returns local manual draft without inserting', async () => {
    const result = await resolveChangeOrderNewDraft({
      projectId: 'proj-1',
      taskId: 'task-1',
    });

    expect(result).toEqual({
      kind: 'draft',
      prefill: {
        linkedFarId: null,
        linkedRfiId: null,
        linkedTaskId: 'task-1',
        title: 'Change order',
        scopeDescription: '',
        reasonForChange: '',
        scheduleImpact: null,
      },
    });
  });

  it('redirects to existing linked change order for FAR', async () => {
    vi.mocked(fetchAdjustmentById).mockResolvedValue({
      id: 'far-1',
      projectId: 'proj-1',
      taskId: null,
      changeOrderId: 'co-existing',
      title: 'Crack repair',
      description: 'Crack',
      conditionDescription: null,
      proposedAdjustment: null,
      reason: null,
      scheduleImpact: null,
    } as Awaited<ReturnType<typeof fetchAdjustmentById>>);

    const result = await resolveChangeOrderNewDraft({
      projectId: 'proj-1',
      farId: 'far-1',
    });

    expect(result).toEqual({ kind: 'existing', changeOrderId: 'co-existing' });
  });

  it('returns FAR prefill without inserting when no linked CO exists', async () => {
    vi.mocked(fetchAdjustmentById).mockResolvedValue({
      id: 'far-1',
      projectId: 'proj-1',
      taskId: 'task-1',
      changeOrderId: null,
      title: 'Crack repair',
      description: 'Crack in slab',
      conditionDescription: 'Visible crack',
      proposedAdjustment: 'Patch',
      reason: 'Weather',
      scheduleImpact: '1 day',
    } as Awaited<ReturnType<typeof fetchAdjustmentById>>);

    const result = await resolveChangeOrderNewDraft({
      projectId: 'proj-1',
      farId: 'far-1',
    });

    expect(result.kind).toBe('draft');
    if (result.kind === 'draft') {
      expect(result.prefill.linkedFarId).toBe('far-1');
      expect(result.prefill.title).toBe('CO — Crack repair');
    }
  });

  it('returns RFI prefill without inserting', async () => {
    vi.mocked(fetchRfiById).mockResolvedValue({
      id: 'rfi-1',
      projectId: 'proj-1',
      taskId: null,
      title: 'Clarify scope',
      question: 'Can we extend the patio?',
      impactSchedule: true,
    } as Awaited<ReturnType<typeof fetchRfiById>>);

    const result = await resolveChangeOrderNewDraft({
      projectId: 'proj-1',
      rfiId: 'rfi-1',
    });

    expect(result.kind).toBe('draft');
    if (result.kind === 'draft') {
      expect(result.prefill.linkedRfiId).toBe('rfi-1');
      expect(result.prefill.scopeDescription).toBe('Can we extend the patio?');
    }
  });
});
