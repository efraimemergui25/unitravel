'use client';

import { useLocaleEngine, type Currency } from '@/store/useLocaleEngine';

// ── FX rates cache ────────────────────────────────────────────────────────────
// Seeded from Open Exchange Rates via /api/currency (ECB daily).
// Falls back to last-known rates; refreshed client-side on mount once per session.

let FX: Record<Currency, number> = {
  USD: 1,
  ILS: 3.72, // fallback — overwritten by live fetch below
};

let fxFetched = false;

/**
 * Fetches live USD→ILS rate from /api/currency once per browser session.
 * Subsequent calls are no-ops. Safe to call from any component.
 */
export async function refreshFXRates(): Promise<void> {
  if (fxFetched || typeof window === 'undefined') return;
  fxFetched = true;
  try {
    const res = await fetch('/api/currency?base=USD', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json() as { rates?: Record<string, number> };
    if (data.rates?.ILS && data.rates.ILS > 0) {
      FX = { USD: 1, ILS: data.rates.ILS };
    }
  } catch {
    // keep fallback rates
  }
}

// Auto-refresh on first client render
if (typeof window !== 'undefined') {
  void refreshFXRates();
}

// Locale tags for Intl.NumberFormat
const INTL_LOCALE: Record<Currency, string> = {
  USD: 'en-US',
  ILS: 'he-IL',
};

// ── Static functions (safe to call outside React) ─────────────────────────────

export function formatCurrency(usd: number, currency: Currency): string {
  const amount = usd * FX[currency];
  return new Intl.NumberFormat(INTL_LOCALE[currency], {
    style:                 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function convertCurrency(usd: number, currency: Currency): number {
  return Math.round(usd * FX[currency]);
}

export function formatCurrencyFromILS(ils: number, currency: Currency): string {
  const usd = ils / FX['ILS'];
  return formatCurrency(usd, currency);
}

// ── React hook — subscribes to locale store, returns reactive formatter ────────
// Use inside FinancialWidget, LiquidTimeline, OmniLedger etc.

export function useCurrencyFormatter() {
  const { profile } = useLocaleEngine();
  const { currency, currencySymbol, locale } = profile;

  return {
    format:  (usd: number) => formatCurrency(usd, currency),
    convert: (usd: number) => convertCurrency(usd, currency),
    symbol:  currencySymbol,
    locale,
    currency,
  };
}

// ── Convenience object for non-hook contexts (e.g. utility imports) ────────────

export const CurrencyEngine = {
  format:  formatCurrency,
  convert: convertCurrency,
  get rates() { return FX; },
} as const;
