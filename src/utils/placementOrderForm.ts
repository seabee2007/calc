import type { PourPlannerFormState } from '../types/pourPlanner';
import type { PlacementOrder, BatchPlantContact } from '../types/placementOrder';
import { DEFAULT_BATCH_PLANT_CONTACT } from '../types/placementOrder';

export function placementOrderFromForm(form: PourPlannerFormState): PlacementOrder {
  const contact: BatchPlantContact = {
    phone: form.batchPlantPhone.trim(),
    email: form.batchPlantEmail.trim(),
    dispatchContact: form.batchPlantDispatchContact.trim(),
    website: form.batchPlantWebsite.trim() || undefined,
    source: form.batchPlantContactSource === 'ai' ? 'ai' : 'manual',
  };

  return {
    status: form.orderStatus || 'draft',
    contact,
    orderNotes: form.orderNotes.trim(),
    updatedAt: new Date().toISOString(),
    batchPlantName: form.batchPlantName.trim() || undefined,
    batchPlantAddress: form.batchPlantAddress.trim() || undefined,
  };
}

export function applyPlacementOrderToForm(
  order: PlacementOrder | undefined,
): Partial<PourPlannerFormState> {
  if (!order) return {};
  const c = order.contact ?? DEFAULT_BATCH_PLANT_CONTACT;
  return {
    batchPlantPhone: c.phone ?? '',
    batchPlantEmail: c.email ?? '',
    batchPlantDispatchContact: c.dispatchContact ?? '',
    batchPlantWebsite: c.website ?? '',
    batchPlantContactSource: c.source === 'ai' ? 'ai' : '',
    orderStatus: order.status ?? '',
    orderNotes: order.orderNotes ?? '',
  };
}
