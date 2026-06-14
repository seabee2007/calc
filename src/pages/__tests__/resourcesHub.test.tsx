import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResourcesHubPage from '../ResourcesHubPage';
import ConcreteResourcesPage from '../resources/ConcreteResourcesPage';
import EstimatingResourcesPage from '../resources/EstimatingResourcesPage';
import ConversionResourcesPage from '../resources/ConversionResourcesPage';
import {
  CONCRETE_RESOURCE_ITEMS,
  RESOURCE_HUB_CATEGORIES,
  getResourceCategory,
} from '../../features/resources/resourceCatalog';
import {
  CONVERSION_SECTIONS,
  PROHIBITED_CONVERSION_TERMS,
  WEIGHT_DENSITY_WARNING,
  WEIGHT_TO_VOLUME_WARNING,
  conversionContentContainsProhibitedTerms,
} from '../../features/resources/conversionResourceCatalog';
import {
  ESTIMATING_RESOURCES,
  PROHIBITED_COMMERCIAL_DATABASE_TERMS,
  PROHIBITED_VENDOR_TERMS,
  estimatingContentContainsProhibitedTerms,
} from '../../features/resources/estimatingResourceCatalog';

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

  it('navigates to estimating tables from available card', () => {
    render(
      <MemoryRouter initialEntries={['/resources']}>
        <Routes>
          <Route path="/resources" element={<ResourcesHubPage />} />
          <Route path="/resources/estimating" element={<EstimatingResourcesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const estimatingCard = screen.getByTestId('resource-category-estimating');
    fireEvent.click(estimatingCard.querySelector('button')!);
    expect(screen.getByTestId('estimating-resources-page')).toBeInTheDocument();
  });

  it('navigates to conversion tables from available card', () => {
    render(
      <MemoryRouter initialEntries={['/resources']}>
        <Routes>
          <Route path="/resources" element={<ResourcesHubPage />} />
          <Route path="/resources/conversions" element={<ConversionResourcesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const conversionsCard = screen.getByTestId('resource-category-conversions');
    fireEvent.click(conversionsCard.querySelector('button')!);
    expect(screen.getByTestId('conversion-resources-page')).toBeInTheDocument();
  });
});

describe('resourceCatalog', () => {
  it('preserves concrete article items', () => {
    expect(CONCRETE_RESOURCE_ITEMS.length).toBeGreaterThanOrEqual(4);
    expect(CONCRETE_RESOURCE_ITEMS.some((i) => i.id === 'mix-designs')).toBe(true);
    expect(CONCRETE_RESOURCE_ITEMS.some((i) => i.id === 'reinforcement')).toBe(true);
  });

  it('marks estimating category as available', () => {
    const estimating = getResourceCategory('estimating');
    expect(estimating?.status).toBe('available');
    expect(estimating?.route).toBe('/resources/estimating');
  });

  it('marks conversions category as available', () => {
    const conversions = getResourceCategory('conversions');
    expect(conversions?.status).toBe('available');
    expect(conversions?.route).toBe('/resources/conversions');
  });
});

describe('EstimatingResourcesPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <EstimatingResourcesPage />
      </MemoryRouter>,
    );

  it('renders title Estimating Tables', () => {
    renderPage();
    expect(screen.getByTestId('estimating-resources-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Estimating Tables' })).toBeInTheDocument();
  });

  it('shows breadcrumb Resources and Estimating', () => {
    renderPage();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Resources');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Estimating');
  });

  it('shows disclaimer note card and Arden estimating note sidebar', () => {
    renderPage();
    expect(screen.getByTestId('estimating-disclaimer-card')).toBeInTheDocument();
    expect(screen.getByTestId('arden-estimating-note')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Arden estimating note' })).toBeInTheDocument();
  });

  it('renders all 12 section cards', () => {
    renderPage();
    expect(ESTIMATING_RESOURCES).toHaveLength(12);
    for (const resource of ESTIMATING_RESOURCES) {
      expect(screen.getByTestId(`estimating-resource-${resource.id}`)).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: resource.title }),
      ).toBeInTheDocument();
    }
  });

  it('does not use concrete-only page branding', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Concrete Resources' })).not.toBeInTheDocument();
    expect(screen.queryByText(/concrete work/i)).not.toBeInTheDocument();
  });

  it('does not contain prohibited vendor names in catalog or rendered page', () => {
    expect(estimatingContentContainsProhibitedTerms()).toEqual([]);
    renderPage();
    const bodyText = document.body.textContent ?? '';
    for (const term of PROHIBITED_VENDOR_TERMS) {
      expect(bodyText).not.toContain(term);
    }
    for (const term of PROHIBITED_COMMERCIAL_DATABASE_TERMS) {
      expect(screen.queryByText(term)).toBeNull();
    }
  });

  it('uses overflow-x-hidden on page shell for mobile layout', () => {
    renderPage();
    expect(screen.getByTestId('estimating-resources-page').className).toContain('overflow-x-hidden');
  });

  it('shows related conversion tables link', () => {
    renderPage();
    expect(screen.getByTestId('related-conversion-tables')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Conversion Tables' })).toHaveAttribute(
      'href',
      '/resources/conversions',
    );
  });
});

describe('ConversionResourcesPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <ConversionResourcesPage />
      </MemoryRouter>,
    );

  it('renders title Conversion Tables', () => {
    renderPage();
    expect(screen.getByTestId('conversion-resources-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Conversion Tables' })).toBeInTheDocument();
  });

  it('shows breadcrumb Resources and Conversion Tables', () => {
    renderPage();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Resources');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      'Conversion Tables',
    );
  });

  it('renders all 17 section cards', () => {
    renderPage();
    expect(CONVERSION_SECTIONS).toHaveLength(17);
    for (const section of CONVERSION_SECTIONS) {
      expect(screen.getByTestId(`conversion-section-${section.id}`)).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: section.title }),
      ).toBeInTheDocument();
    }
  });

  it('includes required reference sections', () => {
    renderPage();
    expect(screen.getByTestId('conversion-section-basic-length-conversions')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-area-conversions')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-volume-conversions')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-imperial-fraction-metric')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-roof-slope-pitch')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-common-conversion-mistakes')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-trade-quick-reference')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-length-imperial-to-metric')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-length-metric-to-imperial')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-area-imperial-to-metric')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-area-metric-to-imperial')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-general-conversion-chart')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-material-weights-density')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-section-rebar-diameter-weight')).toBeInTheDocument();
  });

  it('shows verified conversion values', () => {
    renderPage();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('3.18');
    expect(bodyText).not.toContain('3.78 mm');
    expect(bodyText).toContain('3.9370');
    expect(bodyText).toContain('3.28084');
    expect(bodyText).toContain('1.19599');
    expect(bodyText).toContain('0.500 in');
    expect(bodyText).toContain('0.668 lb/ft');
    expect(bodyText).toContain('1.000 in');
    expect(bodyText).toContain('2.670 lb/ft');
  });

  it('shows density and weight-to-volume warnings', () => {
    renderPage();
    expect(screen.getByText(WEIGHT_DENSITY_WARNING)).toBeInTheDocument();
    expect(screen.getAllByText(WEIGHT_TO_VOLUME_WARNING).length).toBeGreaterThan(0);
  });

  it('does not contain prohibited vendor names or OCR artifacts', () => {
    expect(conversionContentContainsProhibitedTerms()).toEqual([]);
    renderPage();
    const bodyText = document.body.textContent ?? '';
    for (const term of PROHIBITED_CONVERSION_TERMS) {
      expect(bodyText).not.toContain(term);
    }
    expect(bodyText).not.toContain('BoArd Feet');
    expect(bodyText).not.toContain('cuBic');
  });

  it('shows rounding note and field note sidebar', () => {
    renderPage();
    expect(screen.getByTestId('conversion-rounding-note')).toBeInTheDocument();
    expect(screen.getByTestId('conversion-field-note')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Field note' })).toBeInTheDocument();
  });

  it('uses overflow-x-hidden on page shell for mobile layout', () => {
    renderPage();
    expect(screen.getByTestId('conversion-resources-page').className).toContain('overflow-x-hidden');
  });
});
