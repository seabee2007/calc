import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BimObjectPropertiesPanel from '../ui/components/BimObjectPropertiesPanel';

describe('BimObjectPropertiesPanel', () => {
  it('shows placeholder when nothing is selected', () => {
    render(<BimObjectPropertiesPanel selected={null} modelUnit="feet" />);
    expect(screen.getByText(/Select a model object/i)).toBeInTheDocument();
  });

  it('shows selected object properties', () => {
    render(
      <BimObjectPropertiesPanel
        modelUnit="feet"
        selected={{
          externalObjectId: 'mesh-1',
          name: 'Wall-01',
          objectType: 'Mesh',
          category: 'Walls',
          material: 'Concrete',
          level: 'L1',
          properties: {},
          geometryMetrics: {
            width: 10,
            height: 8,
            depth: 0.5,
            approximateSurfaceArea: 170,
            approximateVolume: 40,
          },
        }}
      />,
    );
    expect(screen.getByTestId('bim-object-properties')).toBeInTheDocument();
    expect(screen.getByText('Wall-01')).toBeInTheDocument();
    expect(screen.getByText(/Area suggestion/i)).toBeInTheDocument();
  });
});
