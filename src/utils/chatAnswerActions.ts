/** Extract checklist text from a structured assistant answer for clipboard export. */
export function extractChecklistFromAnswer(content: string): string {
  const sections: string[] = [];
  const keyChecks = content.match(
    /\*\*Key Checks:\*\*([\s\S]*?)(?=\*\*[A-Za-z ]+:\*\*|$)/i,
  );
  const actionPlan = content.match(
    /\*\*Action Plan:\*\*([\s\S]*?)(?=\*\*[A-Za-z ]+:\*\*|$)/i,
  );
  const recommendation = content.match(/\*\*Recommendation:\*\*\s*(.+)/i);

  if (recommendation?.[1]) {
    sections.push(`Recommendation: ${recommendation[1].trim()}`);
  }
  if (keyChecks?.[1]) {
    sections.push('Key Checks:', keyChecks[1].trim());
  }
  if (actionPlan?.[1]) {
    sections.push('Action Plan:', actionPlan[1].trim());
  }

  if (sections.length === 0) {
    return content.trim();
  }

  return sections.join('\n\n');
}
