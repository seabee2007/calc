import type { DocumentClause } from '../../../types';
import { makeStateWarning } from './_shared';

/**
 * Draft-only jurisdictions: no locked statutory notice set is authored yet.
 * Each carries a single review warning so the contractor knows what counsel
 * must address before use. Final export remains blocked.
 */

export const texasNotices: DocumentClause[] = [
  makeStateWarning({
    key: 'notice.tx.warning',
    title: 'Texas Residential Contract - Attorney Review Required',
    state: 'Texas',
    warnings: [
      'Deceptive Trade Practices Act (DTPA) and implied workmanship/habitability warranty issues may apply.',
      'Homestead, lien, and disclosure rules for residential construction must be reviewed by Texas counsel.',
      'Confirm Texas contractor registration/licensing requirements for the trade.',
    ],
    authority: 'Tex. Bus. & Com. Code Ch. 17 (DTPA); Tex. Property Code.',
  }),
];

export const georgiaNotices: DocumentClause[] = [
  makeStateWarning({
    key: 'notice.ga.warning',
    title: 'Georgia Residential Contract - Attorney Review Required',
    state: 'Georgia',
    warnings: [
      'Verify Georgia contractor license requirements for the trade.',
      'Confirm Georgia residential contract, lien, notice, and cancellation requirements with counsel.',
    ],
    authority: 'O.C.G.A. Title 43 (licensing); O.C.G.A. Title 44 (liens).',
  }),
];

export const guamNotices: DocumentClause[] = [
  makeStateWarning({
    key: 'notice.gu.warning',
    title: 'Guam Residential Contract - Attorney Review Required',
    state: 'Guam',
    warnings: [
      'Verify Guam contractor licensing, permit, tax, lien, and consumer protection requirements.',
      'Typhoon, force majeure, material delay, and shipping delay clauses are recommended for Guam projects.',
    ],
    authority: 'Guam Code Annotated (contractor licensing & consumer protection).',
  }),
];
