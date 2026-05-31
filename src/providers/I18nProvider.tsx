'use client';

import { useEffect, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useLocaleStore, LOCALE_META } from '@/store/useLocaleStore';
import en from '../../messages/en.json';
import he from '../../messages/he.json';

const MESSAGES = { en, he } as const;

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const { locale } = useLocaleStore();
  const meta       = LOCALE_META[locale];

  // Keep document attributes in sync (covers SSR hydration gap)
  useEffect(() => {
    document.documentElement.dir  = meta.dir;
    document.documentElement.lang = locale;
  }, [locale, meta.dir]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={MESSAGES[locale]}
      timeZone="America/Mexico_City"
      now={new Date()}
    >
      {children}
    </NextIntlClientProvider>
  );
}
