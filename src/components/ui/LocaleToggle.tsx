'use client';

import { useId, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocaleEngine } from '@/store/useLocaleEngine';

// ── Spring config ─────────────────────────────────────────────────────────────

const PILL_SPRING = { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 } as const;
const LABEL_SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

// ── Option data ───────────────────────────────────────────────────────────────

const OPTIONS = [
  { id: 'en-US' as const, short: 'EN', flag: '🇺🇸', label: 'English' },
  { id: 'he-IL' as const, short: 'HE', flag: '🇮🇱', label: 'עברית'  },
] as const;

// ── Single option ─────────────────────────────────────────────────────────────

const ToggleOption = memo(function ToggleOption({
  option,
  isActive,
  onClick,
}: {
  option:   (typeof OPTIONS)[number];
  isActive: boolean;
  onClick:  () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={LABEL_SPRING}
      aria-pressed={isActive}
      aria-label={option.label}
      style={{
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        gap:            5,
        paddingBlock:   7,
        paddingInline:  12,
        borderRadius:   10,
        background:     'none',
        border:         'none',
        cursor:         'pointer',
        userSelect:     'none',
        WebkitUserSelect:'none',
        zIndex:         1,
        minWidth:       58,
        justifyContent: 'center',
      }}
    >
      {/* Flag — fades between states */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`flag-${option.id}-${isActive}`}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.75 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
        >
          {option.flag}
        </motion.span>
      </AnimatePresence>

      {/* Label — cross-fades */}
      <motion.span
        animate={{
          color:      isActive ? '#1D1D1F' : '#AEAEB2',
          fontWeight: isActive ? 700 : 500,
        }}
        transition={{ duration: 0.2 }}
        style={{ fontSize: 11, letterSpacing: '0.02em', lineHeight: 1 }}
      >
        {option.short}
      </motion.span>
    </motion.button>
  );
});

// ── Main toggle ───────────────────────────────────────────────────────────────

export const LocaleToggle = memo(function LocaleToggle() {
  const { profile, setLocale } = useLocaleEngine();
  const currentLocale = profile.locale;
  const pillId = useId();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...LABEL_SPRING, delay: 0.3 }}
      role="group"
      aria-label="Language selector"
      style={{
        position:        'relative',
        display:         'inline-flex',
        alignItems:      'center',
        padding:         3,
        borderRadius:    14,
        background:      'rgba(255,255,255,0.82)',
        backdropFilter:  'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border:          '1px solid rgba(255,255,255,0.95)',
        boxShadow:       '0 4px 20px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
      }}
    >
      {/* Sliding active pill */}
      <motion.div
        layoutId={pillId}
        style={{
          position:     'absolute',
          top:          3,
          bottom:       3,
          borderRadius: 10,
          background:   'rgba(255,255,255,0.98)',
          boxShadow:    '0 2px 10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
          // Logical positioning: slides to start or end
          ...(currentLocale === 'en-US'
            ? { insetInlineStart: 3, width: 'calc(50% - 3px)' }
            : { insetInlineEnd:   3, width: 'calc(50% - 3px)' }),
        }}
        transition={PILL_SPRING}
      />

      {/* Options */}
      {OPTIONS.map(opt => (
        <ToggleOption
          key={opt.id}
          option={opt}
          isActive={currentLocale === opt.id}
          onClick={() => setLocale(opt.id)}
        />
      ))}
    </motion.div>
  );
});

// ── Compact variant — icon only ───────────────────────────────────────────────

export const LocaleToggleCompact = memo(function LocaleToggleCompact() {
  const { profile, toggleLocale } = useLocaleEngine();
  const next = profile.locale === 'en-US' ? '🇮🇱' : '🇺🇸';
  const current = profile.locale === 'en-US' ? '🇺🇸 EN' : '🇮🇱 HE';

  return (
    <motion.button
      onClick={toggleLocale}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.93 }}
      title={`Switch to ${next}`}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             5,
        paddingBlock:    6,
        paddingInline:   11,
        borderRadius:    10,
        background:      'rgba(255,255,255,0.82)',
        backdropFilter:  'blur(20px)',
        border:          '1px solid rgba(255,255,255,0.95)',
        boxShadow:       '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
        cursor:          'pointer',
        fontSize:        11,
        fontWeight:      700,
        color:           'var(--text-secondary)',
        letterSpacing:   '0.02em',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={profile.locale}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.14 }}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {current}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
});
