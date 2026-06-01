import { describe, expect, it } from 'vitest';
import { assembleDocument, scoreDocumentRisk } from '../index';
import { buildDocumentInput } from './contractInput';
import { buildSaveVersionPayload, restoreBuilderStateFromSnapshot } from './contractVersionState';

describe('buildSaveVersionPayload', () => {
  it('derives the persistence payload from the assembled document and risk', () => {
    const input = buildDocumentInput(
      { projectType: 'remodel', priceModel: 'fixed_price', depositRequired: true },
      ['addendum.hoa_condo'],
      { packKey: 'GENERIC_RESIDENTIAL', mode: 'standard' },
    );
    const assembly = assembleDocument(input);
    const risk = scoreDocumentRisk(input);

    const payload = buildSaveVersionPayload(assembly, risk, {
      title: 'My contract',
      projectId: 'proj-1',
    });

    expect(payload.documentId).toBeNull();
    expect(payload.title).toBe('My contract');
    expect(payload.projectId).toBe('proj-1');
    expect(payload.status).toBe('draft');
    expect(payload.packKey).toBe('GENERIC_RESIDENTIAL');
    expect(payload.mode).toBe('standard');
    expect(payload.outputHash).toBe(assembly.manifest.outputHash);
    expect(payload.sections).toBe(assembly.sections);
    expect(payload.manifest).toBe(assembly.manifest);
    expect(payload.risk).toBe(risk);
  });

  it('passes through an existing documentId and explicit status', () => {
    const input = buildDocumentInput({ projectType: 'remodel' }, []);
    const assembly = assembleDocument(input);
    const risk = scoreDocumentRisk(input);

    const payload = buildSaveVersionPayload(assembly, risk, {
      documentId: 'doc-123',
      title: 'Existing',
      status: 'finalized',
    });

    expect(payload.documentId).toBe('doc-123');
    expect(payload.projectId).toBeNull();
    expect(payload.status).toBe('finalized');
  });
});

describe('restoreBuilderStateFromSnapshot', () => {
  it('round-trips packKey, mode, answers, and accepted addenda', () => {
    const input = buildDocumentInput(
      { projectType: 'concrete', priceModel: 'fixed_price' },
      ['addendum.concrete'],
      { packKey: 'CA_RESIDENTIAL', mode: 'advanced' },
    );
    const snapshot = assembleDocument(input).manifest.inputSnapshot;

    const restored = restoreBuilderStateFromSnapshot(snapshot);

    expect(restored.packKey).toBe('CA_RESIDENTIAL');
    expect(restored.mode).toBe('advanced');
    expect(restored.accepted).toEqual(['addendum.concrete']);
    expect(restored.answers.projectType).toBe('concrete');
  });

  it('falls back to standard mode and no accepted keys when facts are absent', () => {
    const restored = restoreBuilderStateFromSnapshot({
      packKey: 'GENERIC_RESIDENTIAL',
      answers: {},
      facts: {},
    });

    expect(restored.mode).toBe('standard');
    expect(restored.accepted).toEqual([]);
    expect(restored.packKey).toBe('GENERIC_RESIDENTIAL');
  });
});
