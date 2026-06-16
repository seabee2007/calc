import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createCheckoutSession,
  createCustomerPortalSession,
} from '../billingService';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}));

describe('billingService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  });

  it('calls create-checkout-session edge function with validated payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.test/session' }), {
        status: 200,
      }),
    );

    const url = await createCheckoutSession({
      planId: 'professional',
      billingInterval: 'month',
    });

    expect(url).toBe('https://checkout.stripe.test/session');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/create-checkout-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({
          planId: 'professional',
          billingInterval: 'month',
          fieldSeatQuantity: 0,
        }),
      }),
    );
  });

  it('surfaces portal errors when no Stripe customer exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'No Stripe customer found. Start a subscription from the billing page first.',
        }),
        { status: 404 },
      ),
    );

    await expect(createCustomerPortalSession()).rejects.toThrow(/No Stripe customer found/);
  });
});
