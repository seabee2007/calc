import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

/**
 * Shared factories for state-specific notice blocks.
 *
 * LEGAL SAFETY: statutory notices are authored as LOCKED placeholders, not
 * fabricated legal text. Each block names the required statutory content and
 * cites the governing authority so a licensed attorney can insert verified
 * language. These blocks must never be AI-rewritten, summarized, or edited by
 * the assembly engine - hence `locked: true` and `attorneyReviewed: false`.
 */

const STATE_NOTICE_BASE = {
  documentType: 'residential_contract' as const,
  category: 'state_notice' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: true,
  attorneyReviewed: false,
  version: '0.1.0',
};

export interface StateNoticeSpec {
  /** Stable key, e.g. `notice.ca.mechanics_lien`. */
  key: string;
  /** Section title shown in the document. */
  title: string;
  /** Display name of the jurisdiction, e.g. `California`. */
  state: string;
  /** Plain-language description of what the verified notice must contain. */
  requires: string;
  /** Governing statute / agency guidance citation. */
  authority: string;
  /** Optional factual (non-statutory) token lines to surface in the block. */
  fields?: string[];
}

/** A locked statutory notice placeholder (CA / FL / NY style). */
export function makeStateNotice(spec: StateNoticeSpec): DocumentClause {
  const fieldBlock = spec.fields?.length ? `\n\n${spec.fields.join('\n')}` : '';
  return {
    ...STATE_NOTICE_BASE,
    key: spec.key,
    title: spec.title,
    bodyTemplate: `[LOCKED STATUTORY NOTICE - ${spec.state.toUpperCase()}]
${spec.title}

This block must contain the exact statutory language required for ${spec.state}: ${spec.requires} Do not edit, summarize, or AI-rewrite this notice. Insert attorney-verified text before use.${fieldBlock}

Authority: ${spec.authority}`,
  };
}

export interface StateWarningSpec {
  key: string;
  title: string;
  state: string;
  /** Bullet warnings counsel must address for this jurisdiction. */
  warnings: string[];
  authority: string;
}

/** A draft-only review warning for jurisdictions without a locked notice set yet. */
export function makeStateWarning(spec: StateWarningSpec): DocumentClause {
  const bullets = spec.warnings.map((w) => `- ${w}`).join('\n');
  return {
    ...STATE_NOTICE_BASE,
    key: spec.key,
    title: spec.title,
    bodyTemplate: `[STATE REVIEW WARNING - ${spec.state.toUpperCase()}]
${spec.title}

This document is draft-only for ${spec.state}. Before use, counsel licensed in this jurisdiction must review and address:
${bullets}

Authority: ${spec.authority}

Final export is blocked for this jurisdiction until an attorney-reviewed pack is active.`,
  };
}
