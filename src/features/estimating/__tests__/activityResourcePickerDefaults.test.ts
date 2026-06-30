import { describe, expect, it } from 'vitest';
import { resolveImportedResourceDefaultQuantity } from '../ui/components/activityResourcePickerDefaults';

const designBuilderSource = {
  sourceName: 'Arden Design Builder',
  originalName: 'Mortar allowance',
  originalUnit: 'BAG',
  originalDefaultUnitCost: 0,
  selectedAt: '2026-01-01T00:00:00.000Z',
};

describe('activity resource picker imported quantity defaults', () => {
  it('uses a matching imported zero-cost material quantity for starter items', () => {
    const quantity = resolveImportedResourceDefaultQuantity({
      itemName: 'Masonry mortar mix, Type M, 80 lb bag',
      itemUnit: 'BAG',
      itemCategory: 'Concrete Masonry',
      existingResources: [
        {
          name: 'Mortar allowance',
          description: 'mortar_allowance from Design Builder',
          category: 'CMU Wall System',
          quantity: 23,
          unit: 'BAG',
          unitCost: 0,
          sourceSnapshot: designBuilderSource,
        },
      ],
    });

    expect(quantity).toBe('23');
  });

  it('expands CMU wording when matching concrete masonry unit quantities', () => {
    const quantity = resolveImportedResourceDefaultQuantity({
      itemName: 'Concrete masonry unit, 8"x8"x16", standard gray',
      itemUnit: 'EA',
      existingResources: [
        {
          name: 'CMU blocks',
          description: 'cmu_block_count from Design Builder',
          quantity: 3862,
          unit: 'EA',
          unitCost: 0,
          sourceSnapshot: {
            ...designBuilderSource,
            originalName: 'CMU blocks',
            originalUnit: 'EA',
          },
        },
      ],
    });

    expect(quantity).toBe('3862');
  });

  it('keeps 1 when there is no reliable imported quantity match', () => {
    const quantity = resolveImportedResourceDefaultQuantity({
      itemName: 'Generic fastener',
      itemUnit: 'EA',
      existingResources: [
        {
          name: 'Anchor bolts',
          description: 'truss_anchor_bolt_count from Design Builder',
          quantity: 16,
          unit: 'EA',
          unitCost: 0,
          sourceSnapshot: designBuilderSource,
        },
        {
          name: 'Base plates',
          description: 'truss_base_plate_count from Design Builder',
          quantity: 8,
          unit: 'EA',
          unitCost: 0,
          sourceSnapshot: designBuilderSource,
        },
      ],
    });

    expect(quantity).toBe('1');
  });

  it('ignores resources that are already priced or not from Design Builder', () => {
    const quantity = resolveImportedResourceDefaultQuantity({
      itemName: 'Masonry mortar mix, Type M, 80 lb bag',
      itemUnit: 'BAG',
      existingResources: [
        {
          name: 'Mortar allowance',
          description: 'mortar_allowance from Design Builder',
          quantity: 23,
          unit: 'BAG',
          unitCost: 9.5,
          sourceSnapshot: designBuilderSource,
        },
        {
          name: 'Mortar allowance',
          quantity: 31,
          unit: 'BAG',
          unitCost: 0,
          sourceSnapshot: {
            ...designBuilderSource,
            sourceName: 'Manual',
          },
        },
      ],
    });

    expect(quantity).toBe('1');
  });
});
