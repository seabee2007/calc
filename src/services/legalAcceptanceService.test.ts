import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  acceptCurrentLegalDocuments,
  getCurrentLegalAcceptance,
  getLatestLegalAcceptance,
  isDuplicateLegalAcceptanceError,
  isJwtIssuedAtFutureError,
} from './legalAcceptanceService';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';

const userId = 'user-123';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => supabaseMock.from(table),
    auth: {
      getSession: () => supabaseMock.auth.getSession(),
    },
  },
}));

describe('legalAcceptanceService helpers', () => {
  it('detects duplicate legal acceptance errors', () => {
    expect(isDuplicateLegalAcceptanceError({ code: '23505' })).toBe(true);
    expect(isDuplicateLegalAcceptanceError({ status: 409 })).toBe(true);
    expect(
      isDuplicateLegalAcceptanceError({
        message: 'duplicate key value violates unique constraint "user_legal_acceptances_user_versions_unique"',
      }),
    ).toBe(true);
    expect(isDuplicateLegalAcceptanceError({ message: 'some other error' })).toBe(false);
  });

  it('detects JWT issued at future errors', () => {
    expect(isJwtIssuedAtFutureError(new Error('JWT issued at future'))).toBe(true);
    expect(isJwtIssuedAtFutureError({ message: 'JWT issued at future' })).toBe(true);
    expect(isJwtIssuedAtFutureError(new Error('Unauthorized'))).toBe(false);
  });
});

describe('legalAcceptanceService', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('retries JWT issued at future on SELECT and succeeds', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'JWT issued at future' } })
      .mockResolvedValueOnce({
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

    const promise = getCurrentLegalAcceptance(userId);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result?.id).toBe('acc-1');
    expect(supabaseMock.auth.getSession).toHaveBeenCalledTimes(1);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('throws after repeated JWT issued at future on SELECT', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'JWT issued at future' },
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

    const promise = getCurrentLegalAcceptance(userId);
    const expectation = expect(promise).rejects.toThrow('JWT issued at future');

    await vi.advanceTimersByTimeAsync(3000);
    await expectation;

    expect(maybeSingle).toHaveBeenCalledTimes(3);
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

  it('treats duplicate 23505 insert as success', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
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

  it('treats duplicate HTTP 409 insert as success', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { status: 409, message: 'Conflict' },
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'acc-409',
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

    supabaseMock.from.mockImplementation(() => ({
      insert,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        }),
      }),
    }));

    const result = await acceptCurrentLegalDocuments(userId);
    expect(result.id).toBe('acc-409');
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
