import { describe, expect, it } from 'vitest';
import { assembleDocument } from './documentAssembly';
import { evaluateExportPolicy } from './complianceEngine';
import { buildDocumentInput } from '../ui/contractInput';

function sectionKeys(answers: Record<string, unknown>, packKey?: string): string[] {
  const input = buildDocumentInput(answers, [], packKey ? { packKey } : {});
  return assembleDocument(input).sections.map((s) => s.clauseKey);
}

describe('golden scenarios', () => {
  it('generic concrete job includes the concrete differentiator addenda and weather delay', () => {
    const keys = sectionKeys({
      projectType: 'concrete',
      priceModel: 'fixed_price',
      contractPrice: 18000,
      weatherSensitive: true,
    });
    expect(keys).toContain('addendum.concrete');
    expect(keys).toContain('addendum.concrete_cracking');
    expect(keys).toContain('addendum.ready_mix');
    expect(keys).toContain('weather.delay');
  });

  it('roofing job auto-includes the roofing addendum', () => {
    const keys = sectionKeys({ projectType: 'roofing', priceModel: 'fixed_price' });
    expect(keys).toContain('addendum.roofing');
  });

  it('insurance restoration job auto-includes the restoration addendum', () => {
    const keys = sectionKeys({ projectType: 'insurance_restoration', priceModel: 'fixed_price' });
    expect(keys).toContain('addendum.insurance_restoration');
  });

  it('time & materials job includes the T&M pricing clause, progress, retainage, and T&M addendum', () => {
    const keys = sectionKeys({
      projectType: 'remodel',
      priceModel: 'time_and_materials',
      progressPayments: true,
      retainage: true,
    });
    expect(keys).toContain('pricing.time_and_materials');
    expect(keys).toContain('payment.progress');
    expect(keys).toContain('payment.retainage');
    expect(keys).toContain('addendum.time_materials');
    expect(keys).not.toContain('pricing.fixed_price');
  });
});

describe('state packs: notice presence and export gating', () => {
  const states: { packKey: string; prefix: string }[] = [
    { packKey: 'CA_RESIDENTIAL', prefix: 'notice.ca.' },
    { packKey: 'FL_RESIDENTIAL', prefix: 'notice.fl.' },
    { packKey: 'NY_RESIDENTIAL', prefix: 'notice.ny.' },
  ];

  for (const { packKey, prefix } of states) {
    it(`${packKey} appends locked statutory notices and blocks final export`, () => {
      const input = buildDocumentInput(
        { projectType: 'remodel', priceModel: 'fixed_price', contractPrice: 30000 },
        [],
        { packKey },
      );
      const keys = assembleDocument(input).sections.map((s) => s.clauseKey);
      expect(keys.some((k) => k.startsWith(prefix))).toBe(true);

      const policy = evaluateExportPolicy(input);
      expect(policy.allowFinalExport).toBe(false);
    });
  }
});

describe('snapshot stability', () => {
  it('a fixed input yields identical sections and output hash across runs', () => {
    const answers = {
      projectType: 'concrete',
      priceModel: 'fixed_price',
      contractPrice: 12000,
      depositRequired: true,
      depositAmount: 2000,
      weatherSensitive: true,
    };
    const a = assembleDocument(buildDocumentInput(answers, []));
    const b = assembleDocument(buildDocumentInput(answers, []));
    expect(a.sections).toEqual(b.sections);
    expect(a.manifest.outputHash).toBe(b.manifest.outputHash);
  });

  it('a fixed concrete scenario produces a stable ordered set of section keys', () => {
    const keys = sectionKeys({
      projectType: 'concrete',
      priceModel: 'fixed_price',
      contractPrice: 12000,
    });
    expect(keys).toMatchInlineSnapshot(`
      [
        "contract.title",
        "scope.work",
        "scope.exclusions",
        "contract.documents",
        "pricing.fixed_price",
        "payment.schedule",
        "payment.late_payment",
        "change_order.required",
        "change_order.pricing",
        "change_order.unknown_conditions",
        "schedule.project",
        "schedule.delays",
        "schedule.access",
        "risk.permits",
        "risk.code_compliance",
        "risk.force_majeure",
        "completion.substantial",
        "completion.final",
        "warranty.workmanship",
        "warranty.manufacturer",
        "owner.responsibilities",
        "contractor.responsibilities",
        "termination.suspension",
        "termination.general",
        "addendum.concrete",
        "addendum.concrete_cracking",
        "addendum.ready_mix",
        "addendum.concrete_spec_sheet",
        "addendum.ready_mix_order",
        "addendum.concrete_acceptance",
        "addendum.owner_maintenance",
      ]
    `);
  });
});
