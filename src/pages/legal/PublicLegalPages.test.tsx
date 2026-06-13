import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import PrivacyPage from './PrivacyPage';

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null,
  loading: false,
  profileLoading: false,
  signOut: vi.fn(),
  isOwner: false,
  isEmployee: false,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../store/toolsModalStore', () => ({
  useToolsModalStore: () => ({ open: vi.fn() }),
}));

vi.mock('../../store/moreMenuStore', () => ({
  useMoreMenuStore: () => ({ open: vi.fn() }),
}));

describe('public legal pages', () => {
  beforeEach(() => {
    authState.user = null;
  });

  it('renders privacy policy inside the marketing layout with footer href links', () => {
    render(
      <MemoryRouter initialEntries={['/privacy-policy']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/privacy-policy" element={<PrivacyPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Arden Project OS Privacy Policy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy-policy',
    );
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Arden Project OS' })).toHaveAttribute('href', '/');
  });
});
