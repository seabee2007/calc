import { calculateCpm } from '../cpm/calculateCpm';
import type { CpmLogicLink } from '../cpmTypes';
import type { SuggestedLogicLink } from './logicTypes';

export function appendLogicLinks(
  existingLinks: CpmLogicLink[],
  suggestedLinks: Array<Pick<SuggestedLogicLink, 'predecessorActivityCode' | 'successorActivityCode' | 'relationshipType' | 'lagDays'>>,
): CpmLogicLink[] {
  const next = [...existingLinks];
  for (const suggested of suggestedLinks) {
    const duplicate = next.some(
      (link) =>
        link.predecessorActivityCode === suggested.predecessorActivityCode &&
        link.successorActivityCode === suggested.successorActivityCode,
    );
    if (duplicate) continue;
    next.push({
      predecessorActivityCode: suggested.predecessorActivityCode,
      successorActivityCode: suggested.successorActivityCode,
      relationshipType: suggested.relationshipType,
      lagDays: suggested.lagDays,
    });
  }
  return next;
}

export function wouldCreateCircularDependency(
  existingLinks: CpmLogicLink[],
  suggestedLinks: Array<Pick<SuggestedLogicLink, 'predecessorActivityCode' | 'successorActivityCode' | 'relationshipType' | 'lagDays'>>,
): boolean {
  const testLinks = appendLogicLinks(existingLinks, suggestedLinks);
  const codes = new Set<string>();
  for (const link of testLinks) {
    codes.add(link.predecessorActivityCode);
    codes.add(link.successorActivityCode);
  }

  const result = calculateCpm({
    activities: [...codes].map((code) => ({
      activityCode: code,
      activityDescription: code,
      divisionCode: '00',
      divisionName: '',
      durationDays: 1,
      laborHours: 0,
      manDays: 0,
      crewDays: 0,
      crewSize: 1,
      totalCost: 0,
      relationshipType: 'FS' as const,
      lagDays: 0,
    })),
    logicLinks: testLinks,
  });

  return result.warnings.some((warning) => warning.toLowerCase().includes('circular'));
}
