/** Short proposal introduction — does not include the full scope of work. */
export function buildProposalIntroduction(projectName?: string | null): string {
  const name = projectName?.trim() || 'your project';
  return `We are pleased to submit this proposal for ${name}. This proposal outlines the scope of work, pricing, schedule assumptions, and terms for the project described below.`;
}

/**
 * Prevent duplicate SOW in preview/PDF when legacy saved data embeds scope in introduction.
 * Does not mutate stored proposal data.
 */
export function resolveProposalIntroductionForDisplay(
  introduction: string | undefined,
  scope: string | undefined,
  projectTitle?: string | undefined,
): string {
  const intro = introduction?.trim() ?? '';
  const scopeText = scope?.trim() ?? '';

  if (!intro) {
    return buildProposalIntroduction(projectTitle);
  }

  if (scopeText && intro.includes(scopeText)) {
    return buildProposalIntroduction(projectTitle);
  }

  return intro;
}
