import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BimTakeoffMappingPanel, {
  getSuggestedTakeoffQuantity,
} from '../ui/components/BimTakeoffMappingPanel';
import type { BimSelectedObjectSnapshot } from '../types';

vi.mock('../ui/components/ProductionRateLibraryModal', () => ({
  default: () => null,
}));

vi.mock('../../estimating/ui/components/ProductionRateLibraryModal', () => ({
  default: () => null,
}));

const selected: BimSelectedObjectSnapshot = {
  externalObjectId: 'mesh-1',
  name: 'Roof',
  objectType: 'Mesh',
  category: null,
  material: 'Asphalt',
  level: null,
  properties: {},
  geometryMetrics: {
    width: 10,
    height: 2,
    depth: 4,
    approximateSurfaceArea: 136,
    approximateVolume: 80,
  },
};

describe('BimTakeoffMappingPanel', () => {
  it('disables Add to Estimate until object, quantity, unit, and mapping are complete', () => {
    render(
      <BimTakeoffMappingPanel
        selected={selected}
        modelUnit="feet"
        onAddToEstimate={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /Add Takeoff to Estimate/i })).toBeDisabled();
  });

  it('Count takeoff defaults to EA', () => {
    render(
      <BimTakeoffMappingPanel
        selected={selected}
        modelUnit="feet"
        onAddToEstimate={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^count$/i }));

    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EA')).toBeInTheDocument();
  });

  it('Area takeoff uses approximate surface area with a warning', () => {
    render(
      <BimTakeoffMappingPanel
        selected={selected}
        modelUnit="feet"
        onAddToEstimate={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^area$/i }));

    expect(screen.getByDisplayValue('136')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SF')).toBeInTheDocument();
    expect(screen.getByText(/Approximate geometry area/i)).toBeInTheDocument();
  });

  it('Volume takeoff is unavailable when computed volume is zero', () => {
    const flatObject = {
      ...selected,
      geometryMetrics: { ...selected.geometryMetrics, approximateVolume: 0 },
    };
    render(
      <BimTakeoffMappingPanel
        selected={flatObject}
        modelUnit="feet"
        onAddToEstimate={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /^volume$/i })).toBeDisabled();
  });

  it('Manual quantity can always be entered when an object is selected', () => {
    render(
      <BimTakeoffMappingPanel
        selected={selected}
        modelUnit="feet"
        onAddToEstimate={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^manual$/i }));
    const quantity = screen.getByDisplayValue('1');
    fireEvent.change(quantity, { target: { value: '42' } });
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
  });

  it('Use quantity fills measured model quantity and unit fields', () => {
    render(
      <BimTakeoffMappingPanel
        selected={selected}
        modelUnit="feet"
        appliedMeasurement={{
          mode: 'area',
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
            { x: 10, y: 5, z: 0 },
          ],
          closed: true,
          totalLength: 20,
          area: 50,
          perimeter: 30,
          unit: 'SF',
          quantity: 50,
          modelUnit: 'feet',
          scaleConfirmed: false,
          calibrationScaleFactor: 1,
          calibrated: false,
          approximate: false,
        }}
        onAddToEstimate={() => undefined}
      />,
    );

    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SF')).toBeInTheDocument();
    expect(screen.getByLabelText(/Measured from model/i)).toBeChecked();
  });
});

describe('getSuggestedTakeoffQuantity', () => {
  it('converts model-foot volume to cubic yards', () => {
    expect(getSuggestedTakeoffQuantity(selected, 'volume', 'feet')).toEqual({
      quantity: 2.96,
      unit: 'CY',
    });
  });
});
