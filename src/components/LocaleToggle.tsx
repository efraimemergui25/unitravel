'use client';

import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useLocaleStore, LOCALE_META, type Locale } from '@/store/useLocaleStore';

// ── Single option button ──────────────────────────────────────────────────────
function LocaleOption({ id, isActive, onClick }: {
  id:       Locale;
  isActive: boolean;
  onClick:  () => void;
}) {
  const meta = LOCALE_META[id];

  return (
    <motion.button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full z-10 select-none"
      style={{ minWidth: 64 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      aria-label={`Switch to ${meta.label}`}
      aria-pressed={isActive}
    >
      <span className="text-sm leading-none">{meta.flag}</span>
      <motion.span
        className="text-[11px] font-black uppercase tracking-wider"
        animate={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.35)' }}
        transition={{ duration: 0.2 }}
      >
        {id.toUpperCase()}
      </motion.span>
    </motion.button>
  );
}

// ── Main toggle ───────────────────────────────────────────────────────────────
export function LocaleToggle() {
  const { locale, setLocale } = useLocaleStore();

  return (
    <LayoutGroup id="locale-toggle">
      <motion.div
        className="relative flex items-center rounded-full p-0.5"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border:     '1px solid rgba(255,255,255,0.10)',
          boxShadow:  '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        layout
      >
        {/* Sliding glass pill */}
        <AnimatePresence initial={false}>
          <motion.div
            key={locale}
            layoutId="locale-pill"
            className="absolute inset-y-0.5 rounded-full"
            style={{
              insetInlineStart: locale === 'en' ? 2  : 'auto',
              insetInlineEnd:   locale === 'he' ? 2  : 'auto',
              width:            'calc(50% - 2px)',
              background:       locale === 'en'
                ? 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)'
                : 'linear-gradient(135deg, #007AFF 0%, #30D158 100%)',
              boxShadow: locale === 'en'
                ? '0 0 16px rgba(0,122,255,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
                : '0 0 16px rgba(48,209,88,0.4),  inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </AnimatePresence>

        <LocaleOption id="en" isActive={locale === 'en'} onClick={() => setLocale('en')} />
        <LocaleOption id="he" isActive={locale === 'he'} onClick={() => setLocale('he')} />
      </motion.div>
    </LayoutGroup>
  );
}

// ── Compact icon-only variant (for tight spaces) ──────────────────────────────
export function LocaleToggleCompact() {
  const { locale, toggleLocale } = useLocaleStore();
  const meta = LOCALE_META[locale];
  const next = locale === 'en' ? 'he' : 'en';

  return (
    <motion.button
      onClick={toggleLocale}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border:     '1px solid rgba(255,255,255,0.10)',
      }}
      whileHover={{ background: 'rgba(255,255,255,0.10)' }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      title={`Switch to ${LOCALE_META[next].nativeLabel}`}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={locale}
          className="text-sm"
          initial={{ opacity: 0, y: -6, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {meta.flag}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.span
          key={locale + '-label'}
          className="text-[10px] font-black uppercase tracking-wider text-white/70"
          initial={{ opacity: 0, x: locale === 'he' ? 6 : -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {locale.toUpperCase()}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
