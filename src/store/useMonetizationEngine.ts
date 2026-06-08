'use client';

// useMonetizationEngine.ts — Silent affiliate revenue tracker.
// Every placed entity records its commission silently. Admin overlay via Cmd+Shift+M.

import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';
import type { EntityCategory } from '@/store/useTravelEngine';

// ── Affiliate commission rates by source/provider ────────────────────────────

const COMMISSION_RATES: Record<string, number> = {
  // Hotels
  'booking.com':    0.05,
  'expedia':        0.04,
  'hotels.com':     0.04,
  'airbnb':         0.03,
  'agoda':          0.06,
  // Flights
  'skyscanner':     0.02,
  'kayak':          0.015,
  'kiwi':           0.025,
  'travelpayouts':  0.02,
  'amadeus':        0.015,
  // Dining
  'opentable':      0.01,
  'resy':           0.01,
  'yelp':           0.008,
  'google':         0.0,
  // Activities
  'getyourguide':   0.08,
  'viator':         0.08,
  'klook':          0.07,
  // Fallbacks by category
  '__flight':       0.02,
  '__hotel':        0.04,
  '__restaurant':   0.01,
  '__activity':     0.06,
  '__transport':    0.02,
};

function resolveCommissionRate(source: string | undefined, category: EntityCategory): number {
  if (source) {
    const key = source.toLowerCase().replace(/[^a-z0-9.]/g, '');
    if (COMMISSION_RATES[key] !== undefined) return COMMISSION_RATES[key]!;
    // partial match
    const partial = Object.keys(COMMISSION_RATES).find(k => key.includes(k) || k.includes(key));
    if (partial) return COMMISSION_RATES[partial]!;
  }
  return COMMISSION_RATES[`__${category}`] ?? 0.025;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommissionRecord {
  entityId:    string;
  title:       string;
  category:    EntityCategory;
  price:       number;
  provider:    string;
  rate:        number;
  amount:      number;  // price * rate
  recordedAt:  number;
}

interface MonetizationState {
  commissions:       Record<string, CommissionRecord>;
  showAdminPanel:    boolean;
  totalRevenue:      number;
  revenueByCategory: Record<EntityCategory, number>;

  recordPlacement: (entity: {
    id:       string;
    title:    string;
    category: EntityCategory;
    price:    number;
    source?:  string;
    tags?:    string[];
  }) => void;
  removePlacement:   (entityId: string) => void;
  toggleAdminPanel:  () => void;
  clearAll:          () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMonetizationEngine = create<MonetizationState>()(
  immer((set) => ({
    commissions:       {},
    showAdminPanel:    false,
    totalRevenue:      0,
    revenueByCategory: { flight: 0, hotel: 0, restaurant: 0, activity: 0, transport: 0 },

    recordPlacement: (entity) =>
      set(s => {
        // Infer provider from source tag (e.g. tag "src:booking.com")
        const srcTag = entity.tags?.find(t => t.startsWith('src:'));
        const provider = srcTag ? srcTag.slice(4) : entity.source ?? 'direct';
        const rate   = resolveCommissionRate(provider, entity.category);
        const amount = Math.round(entity.price * rate * 100) / 100;

        s.commissions[entity.id] = {
          entityId:   entity.id,
          title:      entity.title,
          category:   entity.category,
          price:      entity.price,
          provider,
          rate,
          amount,
          recordedAt: Date.now(),
        };

        // Recompute totals
        s.totalRevenue = Object.values(s.commissions).reduce((sum, c) => sum + c.amount, 0);
        s.revenueByCategory = Object.values(s.commissions).reduce(
          (acc, c) => ({ ...acc, [c.category]: (acc[c.category] ?? 0) + c.amount }),
          { flight: 0, hotel: 0, restaurant: 0, activity: 0, transport: 0 },
        );
      }),

    removePlacement: (entityId) =>
      set(s => {
        delete s.commissions[entityId];
        s.totalRevenue = Object.values(s.commissions).reduce((sum, c) => sum + c.amount, 0);
        s.revenueByCategory = Object.values(s.commissions).reduce(
          (acc, c) => ({ ...acc, [c.category]: (acc[c.category] ?? 0) + c.amount }),
          { flight: 0, hotel: 0, restaurant: 0, activity: 0, transport: 0 },
        );
      }),

    toggleAdminPanel: () =>
      set(s => { s.showAdminPanel = !s.showAdminPanel; }),

    clearAll: () =>
      set(s => {
        s.commissions        = {};
        s.totalRevenue       = 0;
        s.revenueByCategory  = { flight: 0, hotel: 0, restaurant: 0, activity: 0, transport: 0 };
      }),
  })),
);

// ── Convenience selector ──────────────────────────────────────────────────────

export function useAdminRevenue() {
  return useMonetizationEngine(s => ({
    total:      s.totalRevenue,
    byCategory: s.revenueByCategory,
    records:    Object.values(s.commissions).sort((a, b) => b.amount - a.amount),
    show:       s.showAdminPanel,
    toggle:     s.toggleAdminPanel,
  }));
}
