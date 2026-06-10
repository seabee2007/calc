/** Stable candidate id for a saved estimate line on a specific version. */
export function buildEstimateScheduleCandidateId(
  estimateVersionId: string,
  estimateLineItemId: string,
): string {
  return `${estimateVersionId}:${estimateLineItemId}`;
}

/** Stable candidate id for a saved construction activity on a specific version. */
export function buildConstructionActivityScheduleCandidateId(
  estimateVersionId: string,
  constructionActivityId: string,
): string {
  return `${estimateVersionId}:ca:${constructionActivityId}`;
}
