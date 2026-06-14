import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResourcesHubPage from '../ResourcesHubPage';
import ConcreteResourcesPage from '../resources/ConcreteResourcesPage';
import {
  CONCRETE_RESOURCE_ITEMS,
  RESOURCE_HUB_CATEGORIES,
} from '../../features/resources/resourceCatalog';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

describe('ResourcesHubPage', () => {
  it('renders trade-neutral hub title and subtitle', () => {
    render(
      <MemoryRouter>
        <ResourcesHubPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('resources-hub-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Resources' })).toBeInTheDocument();
    expect(
      screen.getByText(/Printable forms, calculation references, estimating tables/),
    ).toBeInTheDocument();
  });

  it('lists hub categories including concrete and coming soon sections', () => {
    render(
      <MemoryRouter>
        <ResourcesHubPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('resource-category-concrete')).toBeInTheDocument();
    expect(screen.getByTestId('resource-category-estimating')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(RESOURCE_HUB_CATEGORIES).toHaveLength(9);
  });

  it('navigates to concrete resources from available card', () => {
    const chatStore = { isVisible: true, setIsVisible: vi.fn() };
    render(
      <MemoryRouter initialEntries={['/resources']}>
        <Routes>
          <Route path="/resources" element={<ResourcesHubPage />} />
          <Route
            path="/resources/concrete"
            element={<ConcreteResourcesPage chatStore={chatStore} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const concreteCard = screen.getByTestId('resource-category-concrete');
    fireEvent.click(concreteCard.querySelector('button')!);
    expect(screen.getByTestId('concrete-resources-page')).toBeInTheDocument();
  });
});

describe('resourceCatalog', () => {
  it('preserves concrete article items', () => {
    expect(CONCRETE_RESOURCE_ITEMS.length).toBeGreaterThanOrEqual(4);
    expect(CONCRETE_RESOURCE_ITEMS.some((i) => i.id === 'mix-designs')).toBe(true);
    expect(CONCRETE_RESOURCE_ITEMS.some((i) => i.id === 'reinforcement')).toBe(true);
  });
});
