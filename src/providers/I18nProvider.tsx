'use client';

import { useEffect, type ReactNode }   from 'react';
import { NextIntlClientProvider }       from 'next-intl';
import { useLocaleStore, LOCALE_META }  from '@/store/useLocaleStore';
import { useCrisisManager }             from '@/utils/CrisisManager';
import { AnticipatoryToastStack }       from '@/components/AnticipatoryToast';
import en from '../../messages/en.json';
import he from '../../messages/he.json';

const MESSAGES = { en, he } as const;

interface I18nProviderProps {
  children: ReactNode;
}

// Crisis daemon must live inside NextIntlClientProvider so AnticipatoryToastStack
// can use useTranslations('Crisis'). CrisisBootstrap is a mount-only inner component.
function CrisisBootstrap() {
  useCrisisManager();
  return null;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const { locale } = useLocaleStore();
  const meta       = LOCALE_META[locale];

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
      <CrisisBootstrap />
      {children}
      <AnticipatoryToastStack />
    </NextIntlClientProvider>
  );
}
