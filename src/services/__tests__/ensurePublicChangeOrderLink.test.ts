import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../config/brand', () => ({
  getPublicAppUrl: (path: string) => `https://app.example.com${path}`,
}));

import { supabase } from '../../lib/supabase';
import { ensurePublicChangeOrderLink } from '../changeOrderService';

function mockChangeOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'co-1',
    project_id: 'proj-1',
    user_id: 'user-1',
    title: 'Change order',
    scope_description: '',
    reason_for_change: '',
    terms: '',
    labor_items: [],
    material_items: [],
    equipment_items: [],
    subcontractor_items: [],
    markup_percent: 0,
    subtotal: 0,
    total: 100,
    status: 'draft',
    public_token: 'token-abc',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ensurePublicChangeOrderLink', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
  });

  it('returns change order and absolute public URL when token exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: mockChangeOrderRow(),
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const result = await ensurePublicChangeOrderLink('co-1');

    expect(result.url).toBe('https://app.example.com/change-order/token-abc');
    expect(result.changeOrder.id).toBe('co-1');
    expect(result.changeOrder.publicToken).toBe('token-abc');
  });

  it('throws when public token is missing', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: mockChangeOrderRow({ public_token: '' }),
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await expect(ensurePublicChangeOrderLink('co-1')).rejects.toThrow(
      'Public review token is missing',
    );
  });
});
