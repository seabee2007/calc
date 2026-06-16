import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserPreferences,
  updateDashboardLayout,
} from '../userPreferencesService';
import {
  DASHBOARD_CARD_IDS,
  getDefaultDashboardLayout,
} from '../../lib/dashboardLayout';

const authUser = vi.hoisted(() => ({ id: 'user-123' }));

const dbState = vi.hoisted(() => ({
  storedRow: null as Record<string, unknown> | null,
  upsertedRow: null as Record<string, unknown> | null,
}));

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => supabaseMock.getUser() },
    from: (table: string) => supabaseMock.from(table),
  },
}));

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve({ data: dbState.storedRow, error: null }),
    }),
    single: () => Promise.resolve({ data: dbState.upsertedRow, error: null }),
  });
  builder.upsert = (row: Record<string, unknown>) => {
    dbState.upsertedRow = row;
    return builder;
  };
  return builder;
}

describe('userPreferencesService dashboard_layout wiring', () => {
  beforeEach(() => {
    supabaseMock.getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    dbState.storedRow = null;
    dbState.upsertedRow = null;
    supabaseMock.from.mockReset();
    supabaseMock.from.mockImplementation(() => makeBuilder());
  });

  it('reads dashboard_layout from the row', async () => {
    const saved = getDefaultDashboardLayout();
    dbState.storedRow = { user_id: authUser.id, dashboard_layout: saved };

    const prefs = await getUserPreferences();
    expect(prefs.dashboardLayout).toEqual(saved);
  });

  it('returns null layout when the column is empty', async () => {
    dbState.storedRow = { user_id: authUser.id, dashboard_layout: null };

    const prefs = await getUserPreferences();
    expect(prefs.dashboardLayout).toBeNull();
  });

  it('validates/migrates and writes dashboard_layout on update', async () => {
    dbState.storedRow = { user_id: authUser.id, dashboard_layout: null };

    // A messy layout: unknown card id plus a single known card.
    const messy = {
      version: 2,
      items: [
        { id: 'businessSnapshot', x: 0, y: 0, w: 12, h: 4 },
        { id: 'unknownCard', x: 0, y: 1, w: 6, h: 4 },
      ],
    } as never;

    const result = await updateDashboardLayout(messy);

    // The persisted row carries a cleaned, full-registry layout.
    const writtenLayout = dbState.upsertedRow?.dashboard_layout as {
      items: { id: string }[];
    };
    expect(writtenLayout.items).toHaveLength(DASHBOARD_CARD_IDS.length);
    expect(writtenLayout.items.map((i) => i.id)).not.toContain('unknownCard');
    expect(result.dashboardLayout?.items).toHaveLength(DASHBOARD_CARD_IDS.length);
  });
});
