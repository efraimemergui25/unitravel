'use client';

import { motion, LayoutGroup } from 'framer-motion';
import { useLocaleEngine }     from '@/store/useLocaleEngine';

// ── Spring constants ──────────────────────────────────────────────────────────
// Internal pill transition uses snappy spring; hover uses audit-mandated 300/20
const SPRING_PILL = { type: 'spring', stiffness: 420, damping: 30 } as const;
const SPRING_HOV  = { type: 'spring', stiffness: 300, damping: 20 } as const;

const OPTIONS = [
  { id: 'en-US' as const, flag: '🇺🇸', label: 'EN' },
  { id: 'he-IL' as const, flag: '🇮🇱', label: 'HE' },
] as const;

// ── Main segmented control ────────────────────────────────────────────────────

export function LocaleToggle() {
  const { profile, toggleDualBrain } = useLocaleEngine();
  const activeLocale = profile.locale;

  return (
    <LayoutGroup id="locale-dual-brain">
      <motion.button
        onClick={toggleDualBrain}
        aria-label={activeLocale === 'en-US' ? 'Switch to Hebrew' : 'Switch to English'}
        // All shadow lives in `style` so FM can animate it on hover
        className="relative flex items-center gap-1 p-1 rounded-full bg-white/30 backdrop-blur-3xl border border-white/60 cursor-pointer"
        style={{
          boxShadow: '0 4px 20px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.90)',
          userSelect: 'none',
        }}
        // ── Audit: spring 300/20, y:-1 lift, inner glow intensification ──────
        whileHover={{
          y:         -1,
          boxShadow: '0 6px 26px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,1)',
        }}
        whileTap={{ scale: 0.97, y: 0 }}
        transition={SPRING_HOV}
      >
        {OPTIONS.map(({ id, flag, label }) => {
          const isActive = activeLocale === id;
          return (
            <span
              key={id}
              className="relative flex items-center gap-1.5 px-3 py-[7px] rounded-full"
              style={{ zIndex: 1 }}
            >
              {/* Sliding glass pill — LayoutGroup drives the cross-fade position */}
              {isActive && (
                <motion.div
                  layoutId="locale-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
                    boxShadow:  '0 2px 12px rgba(0,122,255,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
                    zIndex:    -1,
                  }}
                  transition={SPRING_PILL}
                />
              )}
              <motion.span
                className="text-sm leading-none select-none"
                animate={{ scale: isActive ? 1.05 : 1 }}
                transition={SPRING_PILL}
              >
                {flag}
              </motion.span>
              <motion.span
                animate={{ color: isActive ? '#ffffff' : '#48484A' }}
                transition={{ duration: 0.18 }}
                style={{ fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em', userSelect: 'none' }}
              >
                {label}
              </motion.span>
            </span>
          );
        })}
      </motion.button>
    </LayoutGroup>
  );
}

// ── Compact variant for tight spaces (zone nav, toolbar) ──────────────────────

export function LocaleToggleCompact() {
  const { profile, toggleDualBrain } = useLocaleEngine();
  const isHe = profile.locale === 'he-IL';

  return (
    <motion.button
      onClick={toggleDualBrain}
      aria-label={isHe ? 'Switch to English' : 'Switch to Hebrew'}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/30 backdrop-blur-3xl border border-white/60 cursor-pointer"
      style={{
        boxShadow: '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)',
        userSelect: 'none',
      }}
      // ── Audit: spring 300/20, y:-2 lift, glow intensification ───────────
      whileHover={{
        y:         -2,
        scale:      1.02,
        boxShadow: '0 4px 18px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,1)',
      }}
      whileTap={{ scale: 0.96, y: 0 }}
      transition={SPRING_HOV}
    >
      <motion.span
        key={profile.locale}
        className="text-sm leading-none select-none"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_PILL}
      >
        {isHe ? '🇮🇱' : '🇺🇸'}
      </motion.span>
      <span style={{
        fontSize:      10,
        fontWeight:    800,
        letterSpacing: '-0.01em',
        color:         '#48484A',
        userSelect:    'none',
      }}>
        {isHe ? 'HE' : 'EN'}
      </span>
    </motion.button>
  );
}
