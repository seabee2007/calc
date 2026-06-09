import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    signOut: vi.fn(),
    isOwner: false,
    isEmployee: false,
  }),
}));

vi.mock('../store/toolsModalStore', () => ({
  useToolsModalStore: () => ({ open: vi.fn() }),
}));

describe('Navbar logged-out mobile', () => {
  it('renders sign in and sign up controls', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });
});
