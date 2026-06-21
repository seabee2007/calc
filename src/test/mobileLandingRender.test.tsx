import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Home from '../pages/Home';
import * as brand from '../config/brand';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null,
  loading: false,
  profileLoading: false,
  signOut: vi.fn(),
  isOwner: false,
  isEmployee: false,
}));

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

vi.mock('../store/toolsModalStore', () => ({
  useToolsModalStore: () => ({ open: vi.fn() }),
}));

vi.mock('../store/moreMenuStore', () => ({
  useMoreMenuStore: () => ({ open: vi.fn() }),
}));

vi.mock('../pages/OperationsDashboard', () => ({
  default: () => <div>Operations Dashboard</div>,
}));

describe('mobile signed-out landing render', () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    authState.profileLoading = false;
    authState.isOwner = false;
    authState.isEmployee = false;
    window.innerWidth = 390;
    window.innerHeight = 844;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders marketing home inside layout without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Arden Project OS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Arden Project OS Construction Management Suite' }),
    ).toBeInTheDocument();
  });

  it('points sign-in to the app login URL on the marketing host', () => {
    vi.spyOn(brand, 'isMarketingHost').mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      'https://app.ardenprojectos.com/login',
    );
  });
});
