import type { Project } from '../types';
import { formatUSAddress } from '../types/address';

/** Safe project summary for AI chat — no margins, labor rates, or supplier pricing. */
export function buildChatProjectContext(project: Project | null | undefined): string | null {
  if (!project) return null;

  const lines: string[] = [`Project name: ${project.name}`];

  if (project.description?.trim()) {
    lines.push(`Scope: ${project.description.trim()}`);
  }

  if (project.pourDate) {
    try {
      lines.push(
        `Scheduled placement: ${new Date(project.pourDate).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`,
      );
    } catch {
      lines.push(`Scheduled placement: ${project.pourDate}`);
    }
  }

  const jobsite = project.jobsiteAddress;
  if (jobsite?.city?.trim() || jobsite?.state?.trim()) {
    const formatted = formatUSAddress(jobsite);
    if (formatted) lines.push(`Jobsite: ${formatted}`);
  }

  const calcs = project.calculations ?? [];
  const totalCy = calcs.reduce((sum, c) => sum + (c.result?.volume ?? 0), 0);
  if (totalCy > 0) {
    lines.push(`Estimated concrete volume: ${totalCy.toFixed(1)} CY`);
  }

  const primaryCalc = calcs[0];
  if (primaryCalc?.psi) {
    lines.push(`Mix strength (from calc): ${primaryCalc.psi} PSI`);
  }
  if (primaryCalc?.type) {
    lines.push(`Placement type: ${primaryCalc.type.replace(/_/g, ' ')}`);
  }

  if (project.mixProfile) {
    lines.push(`Mix profile: ${project.mixProfile}`);
  }

  const stage = project.placementOrder?.lifecycleStage;
  if (stage) {
    lines.push(`Workflow stage: ${stage.replace(/_/g, ' ')}`);
  }

  const batchPlant = project.placementOrder?.batchPlantName?.trim();
  if (batchPlant) {
    lines.push(`Batch plant: ${batchPlant}`);
  }

  const qcCount = project.qcRecords?.length ?? 0;
  if (qcCount > 0) {
    lines.push(`QC records on file: ${qcCount}`);
  }

  return lines.join('\n');
}
