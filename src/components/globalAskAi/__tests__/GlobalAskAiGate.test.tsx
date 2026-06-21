import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_FUNCTIONS_URL', 'https://fn.test');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GlobalAskAiGate from '../GlobalAskAiGate';
import ConcreteChat from '../../ConcreteChat';

const useSubscription = vi.fn();

vi.mock('../../../routes/lazyPages', () => ({
  LazyConcreteChat: () => <div data-testid="global-ask-ai-open">Ask AI</div>,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner-1' },
    profile: { id: 'owner-1', role: 'owner', employerId: null },
  }),
}));

vi.mock('../../../contexts/SubscriptionContext', () => ({
  useSubscription: () => useSubscription(),
}));

vi.mock('../../../store', () => ({
  useProjectStore: () => ({
    projects: [],
    currentProject: null,
    loadProjects: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useLocation: () => ({ pathname: '/' }),
    useNavigate: () => vi.fn(),
  };
});

const supabaseGetSession = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => supabaseGetSession(),
    },
  },
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Global Ask AI plan gate', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ENFORCE_PLAN', 'true');
    useSubscription.mockReset();
    supabaseGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    Element.prototype.scrollTo = vi.fn();
  });

  describe('GlobalAskAiGate', () => {
    it('1. Free user does not see floating Ask AI', () => {
      useSubscription.mockReturnValue({
        hasFeature: () => false,
        loading: false,
      });
      renderWithRouter(<GlobalAskAiGate />);

      expect(screen.queryByTestId('global-ask-ai-open')).not.toBeInTheDocument();
    });

    it('2. Starter user sees floating Ask AI', () => {
      useSubscription.mockReturnValue({
        hasFeature: (feature: string) => feature === 'global_ask_ai',
        loading: false,
      });
      renderWithRouter(<GlobalAskAiGate />);

      expect(screen.getByTestId('global-ask-ai-open')).toBeInTheDocument();
    });

    it('3. Professional user sees floating Ask AI', () => {
      useSubscription.mockReturnValue({
        hasFeature: (feature: string) => feature === 'global_ask_ai',
        loading: false,
      });
      renderWithRouter(<GlobalAskAiGate />);

      expect(screen.getByTestId('global-ask-ai-open')).toBeInTheDocument();
    });

    it('4. Business user sees floating Ask AI', () => {
      useSubscription.mockReturnValue({
        hasFeature: (feature: string) => feature === 'global_ask_ai',
        loading: false,
      });
      renderWithRouter(<GlobalAskAiGate />);

      expect(screen.getByTestId('global-ask-ai-open')).toBeInTheDocument();
    });
  });

  describe('ConcreteChat direct access', () => {
    it('5. Free user direct mount shows upgrade to Starter', async () => {
      useSubscription.mockReturnValue({
        hasFeature: () => false,
        loading: false,
      });
      renderWithRouter(<ConcreteChat />);

      expect(await screen.findByTestId('global-ask-ai-upgrade')).toBeInTheDocument();
      expect(screen.getByTestId('upgrade-required-global_ask_ai')).toBeInTheDocument();
      expect(screen.getByText('Ask AI is available on Starter')).toBeInTheDocument();
    });

    it('6. Starter user can open Ask AI', async () => {
      const user = userEvent.setup();
      useSubscription.mockReturnValue({
        hasFeature: (feature: string) => feature === 'global_ask_ai',
        loading: false,
      });
      renderWithRouter(<ConcreteChat />);

      const openButton = await screen.findByTestId('global-ask-ai-open');
      await user.click(openButton);

      expect(screen.getByLabelText('Close chat')).toBeInTheDocument();
    });

    it('7. Starter Ask AI calls askConcrete endpoint', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ answer: 'Go ahead with placement.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      useSubscription.mockReturnValue({
        hasFeature: (feature: string) => feature === 'global_ask_ai',
        loading: false,
      });
      renderWithRouter(<ConcreteChat />);

      await user.click(await screen.findByTestId('global-ask-ai-open'));
      await user.type(screen.getByPlaceholderText(/ask project assistant/i), 'Can we pour tomorrow?');
      await user.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          'https://fn.test/askConcrete',
          expect.objectContaining({ method: 'POST' }),
        );
      });

      fetchMock.mockRestore();
    });

    it('8. Starter at 50/50 ai_request gets usage_limit_reached, not a plan gate', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'usage_limit_reached',
            featureKey: 'ai.ask_concrete',
            usageUnit: 'ai_request',
            limit: 50,
            used: 50,
            planId: 'starter',
            upgradeRequired: true,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      useSubscription.mockReturnValue({
        hasFeature: (feature: string) => feature === 'global_ask_ai',
        loading: false,
      });
      renderWithRouter(<ConcreteChat />);

      await user.click(await screen.findByTestId('global-ask-ai-open'));
      await user.type(screen.getByPlaceholderText(/ask project assistant/i), 'Need a crew estimate');
      await user.click(screen.getByRole('button', { name: /send message/i }));

      expect(await screen.findByText(/monthly AI request limit/i)).toBeInTheDocument();
      expect(screen.queryByTestId('upgrade-required-global_ask_ai')).not.toBeInTheDocument();

      fetchMock.mockRestore();
    });
  });
});
