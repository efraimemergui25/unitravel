'use client';

import { useLocaleEngine, type Currency } from '@/store/useLocaleEngine';

// ── FX rates cache ────────────────────────────────────────────────────────────
// Seeded from Open Exchange Rates via /api/currency (ECB daily).
// Now maintained by useLocaleEngine.

export async function refreshFXRates(): Promise<void> {
  await useLocaleEngine.getState().refreshFXRates();
}

// ── React hook — subscribes to locale store, returns reactive formatter ────────

export function useCurrencyFormatter() {
  const { profile, formatPrice, convertPrice } = useLocaleEngine();
  const { currency, currencySymbol, locale } = profile;

  return {
    format:  formatPrice,
    convert: convertPrice,
    symbol:  currencySymbol,
    locale,
    currency,
  };
}

// ── Static functions (safe to call outside React) ─────────────────────────────

export function formatCurrency(usd: number, currency: Currency): string {
  // Use state dynamically
  return useLocaleEngine.getState().formatPrice(usd);
}

export function convertCurrency(usd: number, currency: Currency): number {
  return useLocaleEngine.getState().convertPrice(usd);
}

export function formatCurrencyFromILS(ils: number, currency: Currency): string {
  const fx = useLocaleEngine.getState().fxRates['ILS'] || 3.72;
  const usd = ils / fx;
  return formatCurrency(usd, currency);
}

// ── Convenience object for non-hook contexts (e.g. utility imports) ────────────

export const CurrencyEngine = {
  format:  formatCurrency,
  convert: convertCurrency,
  get rates() { return useLocaleEngine.getState().fxRates; },
} as const;
