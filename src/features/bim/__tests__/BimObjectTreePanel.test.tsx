import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BimObjectTreePanel from '../ui/components/BimObjectTreePanel';
import type { BimModelObject } from '../types';

function object(overrides: Partial<BimModelObject> = {}): BimModelObject {
  return {
    id: 'obj-1',
    modelId: 'model-1',
    projectId: 'proj-1',
    externalObjectId: 'mesh-1',
    name: 'Object_2',
    objectType: 'Mesh',
    category: null,
    material: 'Concrete',
    level: null,
    properties: {},
    geometryMetrics: {},
    takeoffStatus: 'unmapped',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('BimObjectTreePanel', () => {
  it('renders outside the canvas with object details and selected state', () => {
    render(
      <BimObjectTreePanel
        objects={[object()]}
        parsedObjects={[]}
        selectedExternalId="mesh-1"
        hiddenExternalIds={new Set()}
        onSelect={() => undefined}
        onToggleVisibility={() => undefined}
      />,
    );

    expect(screen.getByTestId('bim-object-tree')).toBeInTheDocument();
    expect(screen.getByText('Object_2 · Mesh')).toBeInTheDocument();
    expect(screen.getByText('Material: Concrete')).toBeInTheDocument();
  });

  it('selects an object and toggles visibility', () => {
    const onSelect = vi.fn();
    const onToggleVisibility = vi.fn();
    render(
      <BimObjectTreePanel
        objects={[object({ name: null })]}
        parsedObjects={[]}
        selectedExternalId={null}
        hiddenExternalIds={new Set()}
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
      />,
    );

    fireEvent.click(screen.getByText('Unnamed mesh · Mesh'));
    expect(onSelect).toHaveBeenCalledWith('mesh-1');

    fireEvent.click(screen.getByLabelText('Hide object'));
    expect(onToggleVisibility).toHaveBeenCalledWith('mesh-1');
  });

  it('shows an Added badge for mapped objects', () => {
    render(
      <BimObjectTreePanel
        objects={[object({ takeoffStatus: 'mapped' })]}
        parsedObjects={[]}
        selectedExternalId={null}
        hiddenExternalIds={new Set()}
        onSelect={() => undefined}
        onToggleVisibility={() => undefined}
      />,
    );

    expect(screen.getByText('Added')).toBeInTheDocument();
  });
});
