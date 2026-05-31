import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'en' | 'he';

export const LOCALE_META: Record<Locale, {
  label:     string;
  nativeLabel: string;
  dir:       'ltr' | 'rtl';
  flag:      string;
  fontClass: string;
}> = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr', flag: '🇺🇸', fontClass: 'font-sans'   },
  he: { label: 'Hebrew',  nativeLabel: 'עברית',    dir: 'rtl', flag: '🇮🇱', fontClass: 'font-hebrew' },
};

interface LocaleState {
  locale:      Locale;
  setLocale:   (locale: Locale) => void;
  toggleLocale:() => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: 'en',

      setLocale: (locale) => {
        set({ locale });
        // Synchronously update the document direction
        if (typeof document !== 'undefined') {
          const meta = LOCALE_META[locale];
          document.documentElement.dir  = meta.dir;
          document.documentElement.lang = locale;
        }
      },

      toggleLocale: () => {
        const next = get().locale === 'en' ? 'he' : 'en';
        get().setLocale(next);
      },
    }),
    {
      name:    'unitravel-locale',
      // Rehydrate dir attribute on page load
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          const meta = LOCALE_META[state.locale];
          document.documentElement.dir  = meta.dir;
          document.documentElement.lang = state.locale;
        }
      },
    }
  )
);
