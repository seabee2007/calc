import { describe, expect, it } from 'vitest';
import {
  buildImportActivityKey,
  buildScopeImportSourceTemplateKey,
  dedupeImportSuggestions,
  resolveImportDuplicateStatus,
} from './importFromScopeDuplicateUtils';

describe('importFromScopeDuplicateUtils', () => {
  it('builds distinct keys per division and title', () => {
    expect(buildImportActivityKey('03', 'Slab on Grade')).not.toBe(
      buildImportActivityKey('06', 'Slab on Grade'),
    );
    expect(buildImportActivityKey('03', 'Slab on Grade', 'F-1')).not.toBe(
      buildImportActivityKey('03', 'Slab on Grade'),
    );
  });

  it('builds unique scope import source template keys per activity', () => {
    expect(buildScopeImportSourceTemplateKey('03', 'Slab on Grade')).toBe(
      'scope_import:03:slab-on-grade',
    );
    expect(buildScopeImportSourceTemplateKey('03', 'Continuous Footings')).not.toBe(
      buildScopeImportSourceTemplateKey('03', 'Slab on Grade'),
    );
  });

  it('dedupes exact duplicate suggestions within the same batch', () => {
    const prepared = dedupeImportSuggestions(
      [
        { divisionCode: '03', activityTitle: 'Slab on Grade' },
        { divisionCode: '03', activityTitle: 'Slab on Grade' },
      ],
      [],
    );

    expect(prepared).toHaveLength(1);
    expect(prepared[0].duplicateStatus).toBe('none');
  });

  it('marks suggestions that already exist in the estimate', () => {
    const prepared = dedupeImportSuggestions(
      [{ divisionCode: '03', activityTitle: 'Excavate for Foundation' }],
      [{ divisionCode: '03', title: 'Excavate for Foundation' }],
    );

    expect(prepared[0].duplicateStatus).toBe('alreadyInEstimate');
  });

  it('does not treat similar titles in different divisions as duplicates', () => {
    const prepared = dedupeImportSuggestions(
      [
        { divisionCode: '01', activityTitle: 'Site Cleanup' },
        { divisionCode: '09', activityTitle: 'Final Cleanup' },
      ],
      [],
    );

    expect(prepared).toHaveLength(2);
    expect(prepared.every((entry) => entry.duplicateStatus === 'none')).toBe(true);
  });

  it('clears already-in-estimate status when an instance label is provided', () => {
    expect(
      resolveImportDuplicateStatus(
        {
          divisionCode: '03',
          activityTitle: 'Excavate for Foundation',
          instanceLabel: 'F-2',
        },
        [{ divisionCode: '03', title: 'Excavate for Foundation' }],
      ),
    ).toBe('none');
  });
});
