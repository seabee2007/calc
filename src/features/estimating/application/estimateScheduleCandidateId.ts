/** Stable candidate id for a saved estimate line on a specific version. */
export function buildEstimateScheduleCandidateId(
  estimateVersionId: string,
  estimateLineItemId: string,
): string {
  return `${estimateVersionId}:${estimateLineItemId}`;
}
