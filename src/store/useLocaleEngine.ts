import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useLocaleStore } from './useLocaleStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FullLocale = 'en-US' | 'he-IL';
export type Currency   = 'USD' | 'ILS';
export type Direction  = 'ltr' | 'rtl';
export type MeasurementSystem = 'imperial' | 'metric';

export interface CulturalProfile {
  locale:            FullLocale;
  direction:         Direction;
  currency:          Currency;
  currencySymbol:    '$' | '₪';
  currencyDecimal:   '.' | ',';
  currencyThousands: ',' | '.';
  dateFormat:        'MM/DD/YYYY' | 'DD/MM/YYYY';
  measurementSystem: MeasurementSystem;
  weekStart:         0 | 1; // 0 = Sunday (US), 1 = Monday (IL)
  preferredAirlines: string[];
  preferredEngines:  Record<'flights' | 'lodging' | 'dining' | 'attractions' | 'transit', string[]>;
}

// ── Cultural profiles ─────────────────────────────────────────────────────────

const PROFILES: Record<FullLocale, CulturalProfile> = {
  'en-US': {
    locale:            'en-US',
    direction:         'ltr',
    currency:          'USD',
    currencySymbol:    '$',
    currencyDecimal:   '.',
    currencyThousands: ',',
    dateFormat:        'MM/DD/YYYY',
    measurementSystem: 'imperial',
    weekStart:         0,
    preferredAirlines: ['united', 'delta', 'american', 'jetblue', 'southwest'],
    preferredEngines: {
      flights:     ['google-flights', 'kayak', 'expedia-f', 'skyscanner', 'hopper', 'orbitz', 'priceline', 'momondo'],
      lodging:     ['booking', 'expedia', 'hotels-com', 'marriott', 'hyatt', 'hilton', 'airbnb', 'hoteltonight'],
      dining:      ['opentable', 'resy', 'yelp', 'google-maps-d', 'tock', 'michelin', 'tripadvisor-d'],
      attractions: ['tripadvisor', 'viator', 'airbnb-exp', 'getyourguide', 'klook'],
      transit:     ['google-maps-transit', 'uber', 'lyft', 'rome2rio', 'rentalcars'],
    },
  },

  'he-IL': {
    locale:            'he-IL',
    direction:         'rtl',
    currency:          'ILS',
    currencySymbol:    '₪',
    currencyDecimal:   '.',
    currencyThousands: ',',
    dateFormat:        'DD/MM/YYYY',
    measurementSystem: 'metric',
    weekStart:         0, // Israel week starts Sunday
    preferredAirlines: ['el-al', 'arkia', 'israir', 'wizz', 'ryanair', 'easyjet'],
    preferredEngines: {
      flights:     ['skyscanner', 'kiwi', 'google-flights', 'momondo', 'kayak', 'expedia-f', 'wizz', 'easyjet'],
      lodging:     ['booking', 'airbnb', 'expedia', 'agoda', 'hotels-com', 'mrsmith', 'virtuoso'],
      dining:      ['google-maps-d', 'tripadvisor-d', 'yelp', 'opentable', 'resy', 'thefork', 'michelin'],
      attractions: ['viator', 'getyourguide', 'klook', 'tripadvisor', 'airbnb-exp'],
      transit:     ['rome2rio', 'google-maps-transit', 'uber', 'rentalcars', 'turo', 'blablacar'],
    },
  },
};

// ── Exchange rate ──────────────────────────────────────────────────────────────

interface LocaleEngineState {
  profile:          CulturalProfile;
  fxRates:          Record<Currency, number>;
  // Actions
  setLocale:        (locale: FullLocale) => void;
  toggleLocale:     () => void;
  toggleDualBrain:  () => void; // public alias
  refreshFXRates:   () => Promise<void>;
  // Derived helpers
  formatPrice:      (usd: number) => string;
  convertPrice:     (usd: number) => number;
  formatDate:       (iso: string) => string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLocaleEngine = create<LocaleEngineState>()(
  persist(
    (set, get) => ({
      profile: PROFILES['en-US'],
      fxRates: { USD: 1, ILS: 3.72 },

      refreshFXRates: async () => {
        if (typeof window === 'undefined') return;
        try {
          const res = await fetch('/api/currency?base=USD', { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json() as { rates?: Record<string, number> };
          if (data.rates?.ILS && data.rates.ILS > 0) {
            set({ fxRates: { USD: 1, ILS: data.rates.ILS } });
          }
        } catch {
          // keep fallback rates
        }
      },

      setLocale: (locale) => {
        const profile = PROFILES[locale];

        if (typeof document !== 'undefined') {
          document.documentElement.dir  = profile.direction;
          document.documentElement.lang = locale.slice(0, 2);
        }

        const shortLocale = locale.startsWith('he') ? 'he' : 'en';
        useLocaleStore.getState().setLocale(shortLocale);

        set({ profile });
      },

      toggleLocale: () => {
        const current = get().profile.locale;
        get().setLocale(current === 'en-US' ? 'he-IL' : 'en-US');
      },

      toggleDualBrain: () => get().toggleLocale(),

      formatPrice: (usd) => {
        const { currency, currencySymbol, currencyThousands } = get().profile;
        const rates = get().fxRates;
        const amount = usd * (rates[currency] || 1);
        const rounded = Math.round(amount);
        const formatted = rounded
          .toLocaleString('en-US', { maximumFractionDigits: 0 })
          .replace(/,/g, currencyThousands);

        return currency === 'ILS'
          ? `${formatted}${currencySymbol}`
          : `${currencySymbol}${formatted}`;
      },

      convertPrice: (usd) => {
        const { currency } = get().profile;
        const rates = get().fxRates;
        return Math.round(usd * (rates[currency] || 1));
      },

      formatDate: (iso) => {
        const { dateFormat } = get().profile;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return dateFormat === 'MM/DD/YYYY'
          ? `${mm}/${dd}/${yyyy}`
          : `${dd}/${mm}/${yyyy}`;
      },
    }),
    {
      name: 'unitravel-locale-engine',
      partialize: (state) => ({ profile: state.profile, fxRates: state.fxRates }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { profile } = state;
        if (typeof document !== 'undefined') {
          document.documentElement.dir  = profile.direction;
          document.documentElement.lang = profile.locale.slice(0, 2);
        }
        const shortLocale = profile.locale.startsWith('he') ? 'he' : 'en';
        useLocaleStore.getState().setLocale(shortLocale);
        // Fire async refresh
        setTimeout(() => state.refreshFXRates(), 1000);
      },
    },
  ),
);

// ── Convenience selector ──────────────────────────────────────────────────────

export const getLocaleProfile = () => useLocaleEngine.getState().profile;
