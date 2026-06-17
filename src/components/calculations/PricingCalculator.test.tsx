import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PricingCalculator from './PricingCalculator';

// ── Service mocks ─────────────────────────────────────────────────────────────
const findBatchPlantMock = vi.fn();
const lookupBatchPlantPricingMock = vi.fn();
const getMapboxTravelTimeMock = vi.fn();
const getCurrentPositionMock = vi.fn();

vi.mock('../../services/batchPlantService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/batchPlantService')>();
  return {
    ...actual,
    findBatchPlant: (...args: unknown[]) => findBatchPlantMock(...args),
  };
});

vi.mock('../../services/batchPlantPricingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/batchPlantPricingService')>();
  return {
    ...actual,
    lookupBatchPlantPricing: (...args: unknown[]) => lookupBatchPlantPricingMock(...args),
  };
});

vi.mock('../../services/mapboxTravelService', () => ({
  getMapboxTravelTime: (...args: unknown[]) => getMapboxTravelTimeMock(...args),
}));

vi.mock('../../utils/location', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/location')>();
  return {
    ...actual,
    getCurrentPosition: (...args: unknown[]) => getCurrentPositionMock(...args),
    geocodeAddress: vi.fn().mockResolvedValue({
      latitude: 13.5,
      longitude: 144.8,
      address: '100 Main St, Dededo, GU 96929, United States',
    }),
  };
});

vi.mock('../../store', () => ({
  useProjectStore: () => ({ projects: [], updateProject: async () => {} }),
}));

vi.mock('../ui/Card', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('./ReadyMixDelivery', () => ({
  default: () => <div data-testid="ready-mix-delivery" />,
}));

vi.mock('../address/JobsiteLocationSection', () => ({
  default: ({
    onLocationApplied,
  }: {
    onLocationApplied: (loc: { latitude: number; longitude: number; address: string }) => void;
  }) => (
    <div>
      <button
        data-testid="apply-location"
        onClick={() =>
          onLocationApplied({
            latitude: 13.5,
            longitude: 144.8,
            address: '100 Main St, Dededo, GU',
          })
        }
      >
        Verify jobsite
      </button>
    </div>
  ),
}));

const samplePlant = {
  plantName: 'Guam Ready Mix',
  formattedAddress: '200 Plant Rd, Tamuning, GU',
  latitude: 13.48,
  longitude: 144.76,
  distanceMiles: 5.2,
  driveMinutes: 12,
  confidence: 'high' as const,
  source: 'mapbox',
};

function renderCalc() {
  return render(
    <MemoryRouter>
      <PricingCalculator volume={2} psi="3000" variant="calculator" />
    </MemoryRouter>,
  );
}

describe('PricingCalculator — no automatic API calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findBatchPlantMock.mockResolvedValue(samplePlant);
    lookupBatchPlantPricingMock.mockResolvedValue({
      usedAiPricing: true,
      pricing: {
        basePrice: 180,
        psiPriceAdjustments: { '3000': 0 },
        deliveryFees: {
          baseDeliveryFee: 200,
          minimumOrder: 5,
          smallLoadFee: 150,
          distanceFee: 2,
          baseDistance: 10,
        },
        additionalServices: {
          pumpTruckFees: { plant: 800 },
          saturdayDeliveryFee: 100,
          afterHoursFee: 150,
        },
      },
      confidence: 'high',
      notes: 'AI estimate',
      source: 'ai_estimate' as const,
    });
    getMapboxTravelTimeMock.mockResolvedValue({ distanceMiles: 5.2, travelMinutes: 12 });
  });

  it('does not call find-batch-plant on render', () => {
    renderCalc();
    expect(findBatchPlantMock).not.toHaveBeenCalled();
  });

  it('does not call navigator.geolocation on render', () => {
    renderCalc();
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
  });

  it('does not call AI pricing on render', () => {
    renderCalc();
    expect(lookupBatchPlantPricingMock).not.toHaveBeenCalled();
  });

  it('does not call find-batch-plant when jobsite is applied', async () => {
    renderCalc();
    fireEvent.click(screen.getByTestId('apply-location'));
    // Applying location alone must NOT trigger batch plant search
    await new Promise((r) => setTimeout(r, 50));
    expect(findBatchPlantMock).not.toHaveBeenCalled();
  });

  it('calls find-batch-plant exactly once when button clicked', async () => {
    renderCalc();
    // First apply a location so the button is enabled
    fireEvent.click(screen.getByTestId('apply-location'));

    const btn = screen.getByTestId('find-batch-plant-button');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);

    await waitFor(() => {
      expect(findBatchPlantMock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call AI pricing after batch plant is found (must be explicit)', async () => {
    renderCalc();
    fireEvent.click(screen.getByTestId('apply-location'));
    fireEvent.click(screen.getByTestId('find-batch-plant-button'));

    await waitFor(() => {
      expect(screen.getByText('Guam Ready Mix')).toBeInTheDocument();
    });

    // AI pricing button exists but was NOT clicked
    expect(lookupBatchPlantPricingMock).not.toHaveBeenCalled();
  });

  it('calls AI pricing exactly once when button clicked', async () => {
    renderCalc();
    fireEvent.click(screen.getByTestId('apply-location'));
    fireEvent.click(screen.getByTestId('find-batch-plant-button'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-pricing-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ai-pricing-button'));

    await waitFor(() => {
      expect(lookupBatchPlantPricingMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows "Uses map/location credits." helper near the find button', () => {
    renderCalc();
    expect(screen.getByText('Uses map/location credits.')).toBeInTheDocument();
  });

  it('shows "Uses AI credits." helper near the AI pricing button', async () => {
    renderCalc();
    fireEvent.click(screen.getByTestId('apply-location'));
    fireEvent.click(screen.getByTestId('find-batch-plant-button'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-pricing-button')).toBeInTheDocument();
    });

    expect(screen.getByText('Uses AI credits.')).toBeInTheDocument();
  });
});
