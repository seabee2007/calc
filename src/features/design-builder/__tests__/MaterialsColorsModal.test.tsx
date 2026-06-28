import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CMU_INFILL_PLASTER } from '../domain/infillPlaster';
import { DEFAULT_DESIGN_MATERIAL_SELECTION } from '../rendering/materials/designMaterialLibrary';
import MaterialsColorsModal, { type MaterialsColorsApplyPayload } from '../ui/MaterialsColorsModal';

describe('MaterialsColorsModal', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('applies exterior plaster enablement and rough finish settings', () => {
    const onApply = vi.fn<(payload: MaterialsColorsApplyPayload) => void>();

    render(
      <MaterialsColorsModal
        isOpen
        scope="exterior"
        appliedSelections={DEFAULT_DESIGN_MATERIAL_SELECTION}
        appliedPlaster={{
          ...DEFAULT_CMU_INFILL_PLASTER,
          enabled: false,
          finish: 'smooth',
        }}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Exterior Plaster' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Enable exterior plaster'));
    fireEvent.click(screen.getAllByRole('button', { name: /rough/i })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Apply Materials' }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      plaster: expect.objectContaining({
        enabled: true,
        finish: 'textured',
      }),
      selections: expect.objectContaining({
        plasterMaterialId: 'textured-3-coat-plaster',
      }),
    }));
  });

  it('applies interior plaster smooth finish settings', () => {
    const onApply = vi.fn<(payload: MaterialsColorsApplyPayload) => void>();

    render(
      <MaterialsColorsModal
        isOpen
        scope="interior"
        appliedSelections={{
          ...DEFAULT_DESIGN_MATERIAL_SELECTION,
          plasterMaterialId: 'textured-3-coat-plaster',
        }}
        appliedPlaster={{
          ...DEFAULT_CMU_INFILL_PLASTER,
          interiorEnabled: true,
          interiorFinish: 'textured',
        }}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Interior Plaster' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /smooth/i })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Apply Materials' }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      plaster: expect.objectContaining({
        interiorEnabled: true,
        interiorFinish: 'smooth',
      }),
      selections: expect.objectContaining({
        plasterMaterialId: 'smooth-3-coat-plaster',
      }),
    }));
  });
});
