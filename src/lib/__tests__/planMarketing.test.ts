import { describe, expect, it } from 'vitest'
import manifest from '../../../shared/pricing-manifest.json'
import {
  getAnnualSavings,
  getMaxAnnualSavingsPercent,
  getPlanMarketingCards,
  getPlanPricing,
  planHasConfiguredTrial,
} from '../planMarketing'
import { PLAN_DISPLAY_NAMES, PLAN_ORDER } from '../entitlements'

describe('planMarketing catalog', () => {
  it('uses Professional rather than Pro in customer-facing names', () => {
    const cards = getPlanMarketingCards()
    expect(cards.map((card) => card.shortName)).toEqual(['Starter', 'Professional', 'Business'])
    expect(PLAN_DISPLAY_NAMES.professional.short).toBe('Professional')
    expect(cards.some((card) => card.shortName === 'Pro')).toBe(false)
  })

  it('reads prices from the shared pricing manifest', () => {
    for (const entry of manifest.plans) {
      const pricing = getPlanPricing(entry.planId)
      expect(pricing.monthlyUsd).toBe(entry.monthlyPriceUsd)
      expect(pricing.annualTotalUsd).toBe(entry.annualTotalUsd)
    }
  })

  it('computes annual savings from manifest prices', () => {
    const starter = getAnnualSavings('starter')
    expect(starter.annualSavingsUsd).toBe(98)
    expect(getMaxAnnualSavingsPercent()).toBeGreaterThanOrEqual(starter.annualSavingsPercent)
  })

  it('does not advertise a trial when checkout has none configured', () => {
    expect(planHasConfiguredTrial()).toBe(false)
    expect(manifest.trial.hasTrial).toBe(false)
  })

  it('includes verified limits and excludes non-marketable features from highlights', () => {
    const starter = getPlanMarketingCards().find((card) => card.planId === 'starter')
    const professional = getPlanMarketingCards().find((card) => card.planId === 'professional')
    const business = getPlanMarketingCards().find((card) => card.planId === 'business')

    expect(starter?.highlights.some((item) => item.includes('1 field seat'))).toBe(true)
    expect(
      starter?.highlights.some((item) => item.includes('Employee field portal for assigned project work')),
    ).toBe(true)
    expect(professional?.highlights.some((item) => item.includes('5 field seats'))).toBe(true)
    expect(business?.highlights.some((item) => item.includes('15 field seats'))).toBe(true)
    expect(business?.highlights.some((item) => item.includes('Unlimited active projects'))).toBe(true)

    for (const card of getPlanMarketingCards()) {
      const combined = card.highlights.join(' ').toLowerCase()
      expect(combined).not.toContain('design builder')
      expect(combined).not.toContain('3d takeoff')
    }
  })

  it('covers every paid plan in PLAN_ORDER', () => {
    expect(getPlanMarketingCards().map((card) => card.planId)).toEqual(PLAN_ORDER)
  })
})
