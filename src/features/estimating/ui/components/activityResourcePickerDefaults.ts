import type { ActivityResourceBase } from '../../domain/constructionActivityTypes';

export const DEFAULT_RESOURCE_QUANTITY = '1';

type QuantitySeedResource = Pick<
  ActivityResourceBase,
  | 'name'
  | 'description'
  | 'category'
  | 'subcategory'
  | 'quantity'
  | 'unit'
  | 'unitCost'
  | 'sourceSnapshot'
>;

function normalizeUnit(unit: string): string {
  const normalized = unit.trim().toUpperCase();
  if (['EACH', 'EA.', 'E.A.'].includes(normalized)) return 'EA';
  if (['BAGS', 'BAG.'].includes(normalized)) return 'BAG';
  if (['CY', 'CUYD', 'CU YD', 'CUBIC YARD', 'CUBIC YARDS'].includes(normalized)) return 'CYD';
  if (['FT', 'FEET', 'FOOT'].includes(normalized)) return 'LF';
  return normalized;
}

function tokenizeResourceText(value: string | null | undefined): Set<string> {
  const expanded = (value ?? '')
    .toLowerCase()
    .replace(/\bcmu\b/g, 'cmu concrete masonry unit block');
  const ignored = new Set(['and', 'for', 'the', 'with', 'type', 'standard', 'allowance']);
  return new Set(
    expanded
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !ignored.has(token)),
  );
}

function tokenOverlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += 1;
  }
  return score;
}

function isDesignBuilderCostPlaceholder(resource: QuantitySeedResource): boolean {
  const sourceName = resource.sourceSnapshot?.sourceName ?? '';
  const description = resource.description ?? '';
  return (
    Number.isFinite(resource.quantity) &&
    resource.quantity > 0 &&
    Number.isFinite(resource.unitCost) &&
    resource.unitCost <= 0 &&
    (/design builder/i.test(sourceName) || /design builder/i.test(description))
  );
}

export function resolveImportedResourceDefaultQuantity(params: {
  itemName: string;
  itemUnit: string;
  itemCategory?: string;
  itemSubcategory?: string;
  existingResources?: readonly QuantitySeedResource[];
}): string {
  const itemUnit = normalizeUnit(params.itemUnit);
  const itemTokens = tokenizeResourceText(
    `${params.itemName} ${params.itemCategory ?? ''} ${params.itemSubcategory ?? ''}`,
  );
  const unitMatches = (params.existingResources ?? []).filter(
    (resource) =>
      isDesignBuilderCostPlaceholder(resource) &&
      normalizeUnit(resource.unit) === itemUnit,
  );

  if (unitMatches.length === 0) return DEFAULT_RESOURCE_QUANTITY;

  const scored = unitMatches
    .map((resource, index) => {
      const resourceTokens = tokenizeResourceText(
        `${resource.name} ${resource.description ?? ''} ${resource.category ?? ''} ${resource.subcategory ?? ''}`,
      );
      return {
        resource,
        index,
        score: tokenOverlapScore(itemTokens, resourceTokens),
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const best = scored[0];
  if (!best) return DEFAULT_RESOURCE_QUANTITY;
  if (best.score <= 0 && unitMatches.length > 1) return DEFAULT_RESOURCE_QUANTITY;
  return String(best.resource.quantity);
}
