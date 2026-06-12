import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  acceptCurrentLegalDocuments,
  getCurrentLegalAcceptance,
  getLatestLegalAcceptance,
} from './legalAcceptanceService';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';

const userId = 'user-123';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => supabaseMock.from(table),
  },
}));

describe('legalAcceptanceService', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns current acceptance when user accepted current versions', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'acc-1',
        user_id: userId,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
        terms_accepted_at: '2026-06-12T10:00:00.000Z',
        privacy_accepted_at: '2026-06-12T10:00:00.000Z',
        accepted_ip: null,
        accepted_user_agent: 'vitest',
        created_at: '2026-06-12T10:00:00.000Z',
      },
      error: null,
    });

    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        }),
      }),
    });

    const result = await getCurrentLegalAcceptance(userId);
    expect(result?.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(result?.privacyVersion).toBe(CURRENT_PRIVACY_VERSION);
  });

  it('returns null when user has not accepted current versions', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        }),
      }),
    });

    const result = await getCurrentLegalAcceptance(userId);
    expect(result).toBeNull();
  });

  it('inserts acceptance row with current versions', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'acc-2',
        user_id: userId,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
        terms_accepted_at: '2026-06-12T11:00:00.000Z',
        privacy_accepted_at: '2026-06-12T11:00:00.000Z',
        accepted_ip: null,
        accepted_user_agent: 'vitest-agent',
        created_at: '2026-06-12T11:00:00.000Z',
      },
      error: null,
    });

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });

    supabaseMock.from.mockReturnValue({ insert });

    const result = await acceptCurrentLegalDocuments(userId);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
        accepted_ip: null,
      }),
    );
    expect(result.userId).toBe(userId);
  });

  it('treats duplicate insert as success', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'acc-1',
        user_id: userId,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
        terms_accepted_at: '2026-06-12T10:00:00.000Z',
        privacy_accepted_at: '2026-06-12T10:00:00.000Z',
        accepted_ip: null,
        accepted_user_agent: 'vitest',
        created_at: '2026-06-12T10:00:00.000Z',
      },
      error: null,
    });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'user_legal_acceptances') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        insert,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        }),
      };
    });

    const result = await acceptCurrentLegalDocuments(userId);
    expect(result.id).toBe('acc-1');
  });

  it('loads latest acceptance ordered by created_at', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'acc-old',
        user_id: userId,
        terms_version: '2025-01-01',
        privacy_version: '2025-01-01',
        terms_accepted_at: '2025-01-01T00:00:00.000Z',
        privacy_accepted_at: '2025-01-01T00:00:00.000Z',
        accepted_ip: null,
        accepted_user_agent: null,
        created_at: '2025-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });

    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq }),
    });

    const result = await getLatestLegalAcceptance(userId);
    expect(result?.termsVersion).toBe('2025-01-01');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
