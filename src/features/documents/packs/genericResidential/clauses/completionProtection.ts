import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const completionClauses: DocumentClause[] = [
  {
    ...base,
    key: 'completion.substantial',
    title: 'Substantial Completion',
    category: 'completion',
    bodyTemplate: `The work is substantially complete when it can be used for its intended purpose, even if minor punch list items remain. Substantial completion triggers the warranty period and any retainage release stated in this Agreement.

Minor incomplete or cosmetic items do not prevent substantial completion unless applicable law or this Agreement states otherwise.`,
  },
  {
    ...base,
    key: 'completion.final',
    title: 'Final Completion',
    category: 'completion',
    bodyTemplate: `Final completion occurs when all agreed punch list items are complete and any final inspections required by the authority having jurisdiction have passed.

Owner shall make the final payment, including any retainage, upon final completion, less the value of any incomplete or disputed items.`,
  },
];

export const protectionClauses: DocumentClause[] = [
  {
    ...base,
    key: 'insurance.requirements',
    includeWhen: [{ questionKey: 'insuranceProvided', equals: [true] }],
    title: 'Insurance Requirements',
    category: 'insurance',
    bodyTemplate: `Contractor shall maintain insurance coverage as required to perform the work, which may include:
- General liability insurance
- Workers compensation insurance as required by law
- Commercial auto coverage for vehicles used on the project

Certificates of insurance are available to Owner on request. Owner is responsible for maintaining property and homeowner insurance on the Project Property.`,
  },
  {
    ...base,
    key: 'site.protection',
    includeWhen: [{ questionKey: 'siteProtectionConcerns', equals: [true] }],
    title: 'Site Protection',
    category: 'site_protection',
    bodyTemplate: `Contractor shall take reasonable measures to protect the work area during construction. Owner acknowledges that some impact to landscaping, driveways, walkways, and existing surfaces may occur during normal construction activity.

Contractor is not responsible for pre-existing conditions, including existing cracks, settlement, drainage issues, or hidden defects. Existing conditions should be documented before work begins.`,
  },
  {
    ...base,
    key: 'documentation.photos',
    includeWhen: [{ questionKey: 'photoDocumentation', equals: [true] }],
    title: 'Photo Documentation',
    category: 'documentation',
    bodyTemplate: `Owner authorizes Contractor to take before, during, and after photographs and video of the work for documentation, quality control, warranty, and marketing purposes.

If Owner objects to use of project images for marketing, Owner shall notify Contractor in writing. Documentation images may be used to verify site conditions and completed work.`,
  },
  {
    ...base,
    key: 'weather.delay',
    includeWhen: [{ questionKey: 'weatherSensitive', equals: [true] }],
    title: 'Weather Delay',
    category: 'weather',
    bodyTemplate: `Weather conditions may delay the work or affect material delivery and placement. Contractor shall not be responsible for delays or impacts caused by rain, extreme heat, freezing temperatures, high wind, storms, typhoons, hurricanes, flooding, or other weather conditions beyond Contractor's reasonable control.

For weather-sensitive work such as concrete placement, Contractor may reschedule the work to protect quality. The project schedule shall be extended by a reasonable time for weather delays.`,
  },
];
