import React from 'react';
import type { ChangeOrder } from '../../types/changeOrder';
import StandardPricingBreakdown from '../pricing/StandardPricingBreakdown';
import { computePricingBreakdown } from '../../utils/changeOrderFinancials';
import { pricingParamsFromChangeOrder } from '../../utils/pricingParams';

export default function ChangeOrderInternalPricingSummary({ order }: { order: ChangeOrder }) {
  const breakdown = computePricingBreakdown(
    order.laborItems,
    order.materialItems,
    order.equipmentItems,
    order.subcontractorItems ?? [],
    pricingParamsFromChangeOrder(order),
  );

  return <StandardPricingBreakdown breakdown={breakdown} />;
}
