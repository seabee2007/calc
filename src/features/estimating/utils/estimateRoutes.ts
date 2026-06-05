/** Project-scoped estimate workspace (Planner shell). */
export function estimateWorkspaceHref(projectId: string): string {
  return `/projects/${projectId}/planner/estimate`;
}
