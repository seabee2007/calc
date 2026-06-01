import type { DocumentAddendum } from '../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../types';

const base = {
  category: 'addendum' as const,
  documentType: 'residential_contract' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  applicablePriceModels: ALL_PRICE_MODELS,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const genericResidentialAddendums: DocumentAddendum[] = [
  {
    ...base,
    key: 'addendum.change_order',
    title: 'Change Order Addendum',
    bodyTemplate: `CHANGE ORDER

Project: {{project.name}}
Change Order No.: {{changeOrder.number}}
Date: {{changeOrder.date}}

Description of Change: {{changeOrder.description}}
Added Work: {{changeOrder.addedWork}}
Deleted Work: {{changeOrder.deletedWork}}
Price Change: {{currency changeOrder.priceChange}}
Schedule Impact: {{changeOrder.scheduleImpact}}
Revised Contract Price: {{currency changeOrder.revisedContractPrice}}
Revised Completion Date: {{changeOrder.revisedCompletionDate}}

Owner Signature: __________________ Date: ________
Contractor Signature: ______________ Date: ________`,
  },
  {
    ...base,
    key: 'addendum.allowance_schedule',
    includeWhen: [{ questionKey: 'allowances', equals: [true] }],
    title: 'Allowance Schedule Addendum',
    bodyTemplate: `ALLOWANCE SCHEDULE

The Contract Price includes the following allowances:

{{#each allowances}}
- Item: {{item}} | Allowance: {{currency amount}} | Included Quantity: {{quantity}} | Selection Deadline: {{selectionDeadline}} | Notes: {{notes}}
{{/each}}

If Owner selects items above the allowance amount, the difference plus applicable markup, tax, labor, and schedule impact may be added by Change Order. Unused allowance amounts may be credited only as stated in this Agreement.`,
  },
  {
    ...base,
    key: 'addendum.owner_supplied_materials',
    includeWhen: [{ questionKey: 'ownerSuppliedMaterials', equals: [true] }],
    title: 'Owner-Supplied Materials Addendum',
    bodyTemplate: `OWNER-SUPPLIED MATERIALS ADDENDUM

Owner will supply the following items:

{{#each ownerSuppliedMaterials}}
- {{item}} — Required Date: {{requiredDate}}
{{/each}}

Owner is responsible for correct selection, delivery, damage, defects, missing parts, compatibility, and warranty for these items. Delays or rework caused by Owner-supplied materials may result in a Change Order.`,
  },
  {
    ...base,
    key: 'addendum.hoa_condo',
    includeWhen: [{ questionKey: 'hoa', equals: [true] }],
    title: 'HOA / Condo Addendum',
    bodyTemplate: `HOA / CONDO ADDENDUM

This project is subject to HOA, condo association, or property management rules.

Responsible party for approval: {{hoa.responsibleParty}}
Approval status: {{hoa.approvalStatus}}

Owner is responsible for providing all rules, approval letters, work-hour limits, parking rules, elevator rules, noise rules, and access requirements. Delays or added costs caused by HOA or condo requirements may result in a Change Order unless specifically included in the scope.`,
  },
  {
    ...base,
    key: 'addendum.insurance_restoration',
    title: 'Insurance Restoration Addendum',
    applicableProjectTypes: ['insurance_restoration'],
    bodyTemplate: `INSURANCE RESTORATION ADDENDUM

Owner acknowledges that Contractor is not the insurance company, public adjuster, or legal representative unless separately licensed and contracted.

Insurance claim number: {{insurance.claimNumber}}
Insurance carrier: {{insurance.carrier}}
Adjuster: {{insurance.adjuster}}

Contractor's scope is limited to the work stated in this Agreement and approved Change Orders. Insurance approval does not guarantee that all required work is included in the Contract Price.`,
  },
  {
    ...base,
    key: 'addendum.roofing',
    title: 'Roofing Addendum',
    applicableProjectTypes: ['roofing', 'insurance_restoration'],
    bodyTemplate: `ROOFING ADDENDUM

Roofing work includes only the roof areas and scope described in this Agreement.

Excluded unless specifically included: hidden decking replacement, structural repairs, fascia repairs, soffit repairs, gutter replacement, mold remediation, code upgrades, electrical work, solar removal/reinstallation, and antenna or satellite work.

Decking, rot, or concealed damage discovered after tear-off may require a Change Order. State-specific roofing notices, insurance warnings, cancellation rights, and deposit rules must be inserted from the applicable locked state pack.`,
  },
  {
    ...base,
    key: 'addendum.time_materials',
    title: 'Time and Materials Addendum',
    applicablePriceModels: ['time_and_materials'],
    bodyTemplate: `TIME AND MATERIALS ADDENDUM

Labor rates:
{{#each laborRates}}
- {{role}}: {{currency rate}} per hour
{{/each}}

Material markup: {{materialMarkupPercent}}%
Equipment markup: {{equipmentMarkupPercent}}%
Subcontractor markup: {{subcontractorMarkupPercent}}%

Invoices may include labor, material, equipment, subcontractor charges, delivery, disposal, fees, permits, and approved markup. Owner may request supporting documentation for charges where reasonable.`,
  },
  {
    ...base,
    key: 'addendum.design_build',
    includeWhen: [{ questionKey: 'designBuild', equals: [true] }],
    title: 'Design-Build Addendum',
    bodyTemplate: `DESIGN-BUILD ADDENDUM

Contractor may assist with design coordination, constructability input, selections, and scope development. Unless specifically stated, Contractor is not acting as a licensed architect or engineer.

Engineering, architectural drawings, surveys, and stamped plans are excluded unless specifically included. Design changes may affect price and schedule.`,
  },
  {
    ...base,
    key: 'addendum.hazardous_materials',
    includeWhen: [{ questionKey: 'hazardousMaterialsPossible', equals: [true] }],
    title: 'Hazardous Materials Addendum',
    bodyTemplate: `HAZARDOUS MATERIALS ADDENDUM

Owner acknowledges that residential properties may contain hazardous or regulated materials. Contractor is not responsible for identifying, testing, removing, transporting, or disposing of hazardous materials unless specifically included.

If suspected hazardous materials are found, Contractor may stop work in the affected area until qualified testing or remediation is complete.`,
  },
  {
    ...base,
    key: 'addendum.punch_list',
    title: 'Punch List Addendum',
    bodyTemplate: `PUNCH LIST ADDENDUM

Substantial Completion Date: {{punchList.substantialCompletionDate}}

Punch List Items:
{{#each punchList.items}}
- {{description}} — Responsible Party: {{responsibleParty}} — Due: {{dueDate}}
{{/each}}

Minor punch list items do not prevent substantial completion if the work can be used for its intended purpose, unless applicable law or the Agreement states otherwise.`,
  },
];

/** Ordered addendum keys for the Generic Residential Pack. */
export const genericResidentialAddendumKeys: string[] =
  genericResidentialAddendums.map((addendum) => addendum.key);
