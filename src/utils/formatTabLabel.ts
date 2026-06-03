/** Tab label with optional count badge, e.g. "Documents (7)". Omits "(0)". */
export function formatTabLabel(label: string, count?: number): string {
  if (count === undefined || count <= 0) return label;
  return `${label} (${count})`;
}
