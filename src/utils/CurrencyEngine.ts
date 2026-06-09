'use client';

import { useLocaleEngine, type Currency } from '@/store/useLocaleEngine';

// Live FX rates (mocked — swap for live API in production)
const FX: Record<Currency, number> = {
  USD: 1,
  ILS: 3.72,
};

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
  rates:   FX,
} as const;
