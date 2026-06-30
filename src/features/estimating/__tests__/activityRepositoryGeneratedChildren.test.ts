import { describe, expect, it, vi } from 'vitest';
import { isStaleGeneratedChild } from '../infrastructure/activityRepository';

vi.mock('../../../lib/supabase', () => ({
  supabase: {},
}));

describe('activityRepository generated child replacement', () => {
  const source = {
    sourceProvider: 'arden_design_builder' as const,
    designModelId: 'model-1',
    activityKey: 'concrete:rc-roof-beams:place',
    commitBatchId: 'batch-new',
  };

  it('matches only stale Design Builder-generated children for replacement', () => {
    expect(
      isStaleGeneratedChild(
        {
          source_provider: 'arden_design_builder',
          source_snapshot: {
            designModelId: 'model-1',
            activityKey: 'concrete:rc-roof-beams:place',
            commitBatchId: 'batch-old',
          },
        },
        source,
      ),
    ).toBe(true);

    expect(
      isStaleGeneratedChild(
        {
          source_provider: 'manual',
          source_snapshot: null,
        },
        source,
      ),
    ).toBe(false);

    expect(
      isStaleGeneratedChild(
        {
          source_provider: 'arden_design_builder',
          source_snapshot: {
            designModelId: 'model-1',
            activityKey: 'concrete:rc-roof-beams:place',
            commitBatchId: 'batch-new',
          },
        },
        source,
      ),
    ).toBe(false);

    expect(
      isStaleGeneratedChild(
        {
          source_provider: 'arden_design_builder',
          source_snapshot: {
            designModelId: 'model-1',
            activityKey: 'concrete:slab-on-grade:place',
            commitBatchId: 'batch-old',
          },
        },
        source,
      ),
    ).toBe(false);
  });
});
