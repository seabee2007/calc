import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const editModalSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/EditConstructionActivityModal.tsx',
  ),
  'utf8',
);
const builderPanelSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../ui/components/ConstructionActivityBuilderPanel.tsx',
  ),
  'utf8',
);
const sharedModalSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../components/ui/Modal.tsx'),
  'utf8',
);

describe('EditConstructionActivityModal layering', () => {
  it('uses shared Modal with document.body portal', () => {
    expect(editModalSource).toContain("import Modal from '../../../../components/ui/Modal'");
    expect(editModalSource).toContain('<Modal isOpen onClose={onCancel}');
    expect(editModalSource).not.toContain('fixed inset-0 z-50');
    expect(sharedModalSource).toContain('createPortal(modalContent, document.body)');
    expect(sharedModalSource).toContain('z-[9999]');
  });

  it('supports cancel, escape close wiring, and save footer actions', () => {
    expect(editModalSource).toContain('onClose={onCancel}');
    expect(editModalSource).toContain('Cancel');
    expect(editModalSource).toContain('Save Activity');
    expect(editModalSource).toContain('void handleSave()');
  });

  it('embeds Arden Calc without route navigation', () => {
    expect(editModalSource).toContain('Arden Calc');
    expect(editModalSource).toContain('ArdenCalcOverlay');
    expect(editModalSource).not.toContain('/calculator');
    expect(editModalSource).not.toContain('window.location');
    expect(editModalSource).not.toContain('useNavigate');
  });
});

describe('ConstructionActivityBuilderPanel edit modal placement', () => {
  it('renders edit modal alongside activity list state, outside division accordions', () => {
    expect(builderPanelSource).toContain('{editingActivity && (');
    expect(builderPanelSource).toContain('<EditConstructionActivityModal');

    const editModalBlock =
      builderPanelSource.match(
        /\{editingActivity && \([\s\S]*?\/>\s*\)\}/,
      )?.[0] ?? '';
    expect(editModalBlock).toContain('EditConstructionActivityModal');
    expect(editModalBlock).toContain('onCancel={() => setEditingActivity(null)}');
    expect(editModalBlock).not.toContain('DivisionSection');
  });
});
