import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketingHome from './MarketingHome';
import {
  MARKETING_FEATURE_CARDS,
  MARKETING_HERO_TITLE,
} from './marketingHomeContent';

const navigate = vi.fn();
const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isEmployee: false,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../contexts/AppAccessContext', () => ({
  useAppAccess: () => ({
    authSessionResolved: true,
    accessResolutionState: 'resolved',
    access: null,
    refreshAccess: vi.fn(),
    clearAccess: vi.fn(),
  }),
}));

describe('MarketingHome', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isEmployee = false;
    navigate.mockClear();
  });

  it('renders the PM suite hero and removes legacy calculator positioning', () => {
    render(
      <MemoryRouter>
        <MarketingHome />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: MARKETING_HERO_TITLE })).toBeInTheDocument();
    expect(screen.queryByText(/Concrete field operations platform/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/volume math/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dispatch call sheets/i)).not.toBeInTheDocument();
  });

  it('renders signed-out CTAs', () => {
    render(
      <MemoryRouter>
        <MarketingHome />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders all PM suite feature cards', () => {
    render(
      <MemoryRouter>
        <MarketingHome />
      </MemoryRouter>,
    );

    for (const card of MARKETING_FEATURE_CARDS) {
      expect(screen.getByRole('heading', { level: 3, name: card.title })).toBeInTheDocument();
    }
  });

  it('renders open workspace for signed-in users', () => {
    authState.user = { id: 'user-1' };

    render(
      <MemoryRouter>
        <MarketingHome />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Open workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
  });
});
