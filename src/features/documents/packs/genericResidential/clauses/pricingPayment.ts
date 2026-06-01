import type { DocumentClause } from '../../../types';
import { ALL_PRICE_MODELS, ALL_PROJECT_TYPES } from '../../../types';

const base = {
  documentType: 'residential_contract' as const,
  applicableProjectTypes: ALL_PROJECT_TYPES,
  locked: false,
  attorneyReviewed: false,
  version: '0.1.0',
};

export const pricingClauses: DocumentClause[] = [
  {
    ...base,
    key: 'pricing.fixed_price',
    title: 'Fixed Price',
    category: 'pricing',
    applicablePriceModels: ['fixed_price'],
    bodyTemplate: `Owner shall pay Contractor the fixed Contract Price of:

{{currency pricing.contractPrice}}

This price includes only the work described in this Agreement and attached documents. Work outside the stated scope shall require a written change order.`,
  },
  {
    ...base,
    key: 'pricing.time_and_materials',
    title: 'Time and Materials',
    category: 'pricing',
    applicablePriceModels: ['time_and_materials'],
    bodyTemplate: `This project shall be performed on a time and materials basis. Owner shall pay for labor at the rates listed below, materials used for the work, equipment used for the work, subcontractor charges, approved markup, overhead, and profit, and applicable fees, permits, and taxes if stated.

Labor rates:
{{#each pricing.laborRates}}
- {{role}}: {{currency rate}} per hour
{{/each}}

Material markup: {{pricing.materialMarkupPercent}}%
Equipment markup: {{pricing.equipmentMarkupPercent}}%
Subcontractor markup: {{pricing.subcontractorMarkupPercent}}%

Estimated total: {{currency pricing.estimatedTotal}}

This estimate is not a guaranteed maximum price unless this Agreement expressly states otherwise.`,
  },
  {
    ...base,
    key: 'pricing.cost_plus',
    title: 'Cost Plus',
    category: 'pricing',
    applicablePriceModels: ['cost_plus'],
    bodyTemplate: `Owner shall pay Contractor the actual cost of the work plus the Contractor fee stated below. Costs may include labor, materials, equipment, subcontractors, permits, fees, disposal, delivery, insurance-related project costs, and other project-related direct costs.

Contractor fee: {{pricing.contractorFeePercent}}%
Estimated cost: {{currency pricing.estimatedCost}}
Estimated total: {{currency pricing.estimatedTotal}}

Unless this Agreement states a guaranteed maximum price, the estimate is not a fixed price.`,
  },
  {
    ...base,
    key: 'deposit.clause',
    title: 'Deposit',
    category: 'payment',
    applicablePriceModels: ALL_PRICE_MODELS,
    bodyTemplate: `Owner shall pay an initial deposit to reserve scheduling and begin project mobilization, material ordering, and pre-construction work.

Deposit amount: {{currency deposit.amount}}
Deposit percentage: {{deposit.percent}}%
Due date: {{deposit.dueDate}}

The deposit shall be applied to the Contract Price. Deposit limits may be regulated by applicable state law; do not use a deposit amount that exceeds any limit allowed in the project jurisdiction.`,
  },
];

export const paymentClauses: DocumentClause[] = [
  {
    ...base,
    key: 'payment.schedule',
    title: 'Payment Schedule',
    category: 'payment',
    applicablePriceModels: ALL_PRICE_MODELS,
    bodyTemplate: `Owner shall make payments according to the following schedule:

{{#each payment.schedule}}
- Payment {{number}}: Trigger: {{trigger}} | Amount: {{currency amount}} | Due: {{dueCondition}}
{{/each}}

Payments are due upon completion of the stated milestone or upon invoice, as stated above.`,
  },
  {
    ...base,
    key: 'payment.progress',
    title: 'Progress Payments',
    category: 'payment',
    applicablePriceModels: ALL_PRICE_MODELS,
    bodyTemplate: `Owner shall make progress payments as the work reaches the following milestones. Each progress payment is due upon substantial completion of the stated milestone or upon invoice.

{{#each payment.progressMilestones}}
- {{milestone}}: {{currency amount}}
{{/each}}

Typical milestones may include demolition complete, foundation complete, framing complete, rough-in complete, drywall complete, and final completion. Progress payments reflect work performed and are not a guarantee of total project cost.`,
  },
  {
    ...base,
    key: 'payment.retainage',
    title: 'Retainage',
    category: 'payment',
    applicablePriceModels: ALL_PRICE_MODELS,
    bodyTemplate: `Owner may retain {{payment.retainagePercent}}% of each payment until substantial completion of the work. Retainage shall be released within {{payment.retainageReleaseDays}} days after substantial completion, less the value of any incomplete or disputed items.

Retainage rules may be regulated by applicable law. Do not use a retainage amount or hold period that conflicts with the law of the project jurisdiction.`,
  },
  {
    ...base,
    key: 'payment.late_payment',
    title: 'Late Payment',
    category: 'payment',
    applicablePriceModels: ALL_PRICE_MODELS,
    bodyTemplate: `Payments not made when due may result in work suspension after written notice to Owner. Contractor may recover reasonable costs caused by late payment, including remobilization costs, delay costs, collection costs, and other costs allowed by law.

Late fee / finance charge: {{payment.lateFeeDescription}}

Do not use this clause where prohibited by state law.`,
  },
];
