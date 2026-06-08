'use client';

import { memo }                                    from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { useLocaleEngine }                         from '@/store/useLocaleEngine';
import { VIBE_OPTIONS, DIET_OPTIONS }              from '@/components/zones/CulinaryFilters';
import type { VibeOption, DietOption }             from '@/components/zones/CulinaryFilters';

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLOR  = '#FF9F0A';
const SPRING = { type: 'spring', stiffness: 440, damping: 24 } as const;

// ── Vibe pill ─────────────────────────────────────────────────────────────────

const VibePill = memo(function VibePill({
  vibe, isSelected, isHe, onToggle,
}: {
  vibe:       VibeOption;
  isSelected: boolean;
  isHe:       boolean;
  onToggle:   () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isSelected}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.94 }}
      animate={{
        background:  isSelected ? vibe.gradient : 'rgba(255,255,255,0.55)',
        boxShadow:   isSelected
          ? `0 4px 18px ${vibe.color}38, 0 0 0 1.5px ${vibe.color}50`
          : '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(255,255,255,0.80), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
      transition={SPRING}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  6,
        paddingBlock:         8,
        paddingInline:        12,
        borderRadius:         12,
        border:               'none',
        cursor:               'pointer',
        flexShrink:           0,
        fontFamily:           'inherit',
        backdropFilter:       isSelected ? 'none' : 'blur(16px)',
        WebkitBackdropFilter: isSelected ? 'none' : 'blur(16px)',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{vibe.icon}</span>
      <span style={{
        fontSize:      11,
        fontWeight:    isSelected ? 800 : 600,
        color:         isSelected ? '#fff' : '#3C3C43',
        letterSpacing: '-0.01em',
        whiteSpace:    'nowrap',
      }}>
        {isHe ? vibe.labelHe : vibe.label}
      </span>

      <AnimatePresence>
        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING}
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', flexShrink: 0 }}
            aria-hidden
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ── Diet chip ─────────────────────────────────────────────────────────────────

const DietChip = memo(function DietChip({
  diet, isSelected, isHe, onToggle,
}: {
  diet:       DietOption;
  isSelected: boolean;
  isHe:       boolean;
  onToggle:   () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isSelected}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      animate={{
        background: isSelected ? `${COLOR}14` : 'rgba(255,255,255,0.40)',
        boxShadow:  isSelected
          ? `0 0 0 1.5px ${COLOR}48, inset 0 1px 0 rgba(255,255,255,0.7)`
          : '0 0 0 1px rgba(255,255,255,0.70), inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
      transition={SPRING}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  5,
        paddingBlock:         6,
        paddingInline:        10,
        borderRadius:         10,
        border:               'none',
        cursor:               'pointer',
        flexShrink:           0,
        fontFamily:           'inherit',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <span style={{ fontSize: 13 }}>{diet.icon}</span>
      <span style={{
        fontSize:      10.5,
        fontWeight:    isSelected ? 800 : 500,
        color:         isSelected ? COLOR : '#6E6E73',
        letterSpacing: '-0.01em',
        whiteSpace:    'nowrap',
      }}>
        {isHe ? diet.labelHe : diet.label}
      </span>
    </motion.button>
  );
});

// ── Props ─────────────────────────────────────────────────────────────────────

export interface VibeFilterProps {
  selectedVibes: string[];
  selectedDiets: string[];
  onVibesChange: (vibes: string[]) => void;
  onDietsChange: (diets: string[]) => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function VibeFilter({
  selectedVibes,
  selectedDiets,
  onVibesChange,
  onDietsChange,
}: VibeFilterProps) {
  const { profile } = useLocaleEngine();
  const isHe        = profile.locale === 'he-IL';

  const toggleVibe = (id: string) => {
    onVibesChange(
      selectedVibes.includes(id)
        ? selectedVibes.filter(v => v !== id)
        : [...selectedVibes, id]
    );
  };

  const toggleDiet = (id: string) => {
    onDietsChange(
      selectedDiets.includes(id)
        ? selectedDiets.filter(d => d !== id)
        : [...selectedDiets, id]
    );
  };

  const totalActive = selectedVibes.length + selectedDiets.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="glass-panel mx-4 flex-shrink-0 overflow-hidden"
    >
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        paddingInline: 14,
        paddingBlock:  10,
      }}>
        {/* ── Vibe row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 4 }}>
          <span style={{
            fontSize:      9, fontWeight: 700,
            color:         'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            whiteSpace:    'nowrap', flexShrink: 0, minWidth: 36,
          }}>
            {isHe ? 'חוויה' : 'Vibe'}
          </span>
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar"
            style={{ paddingBlock: 2 }}
          >
            {VIBE_OPTIONS.map(v => (
              <VibePill
                key={v.id}
                vibe={v}
                isSelected={selectedVibes.includes(v.id)}
                isHe={isHe}
                onToggle={() => toggleVibe(v.id)}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', marginBlock: 2 }} />

        {/* ── Diet row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 4 }}>
          <span style={{
            fontSize:      9, fontWeight: 700,
            color:         'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            whiteSpace:    'nowrap', flexShrink: 0, minWidth: 36,
          }}>
            {isHe ? 'תזונה' : 'Diet'}
          </span>
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar"
            style={{ paddingBlock: 2 }}
          >
            {DIET_OPTIONS.map(d => (
              <DietChip
                key={d.id}
                diet={d}
                isSelected={selectedDiets.includes(d.id)}
                isHe={isHe}
                onToggle={() => toggleDiet(d.id)}
              />
            ))}
          </div>
        </div>

        {/* Active summary */}
        <AnimatePresence>
          {totalActive > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR, flexShrink: 0 }}
                aria-hidden
              />
              <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
                {isHe
                  ? `AI מסנן: ${totalActive} פילטרים פעילים`
                  : `AI filtering: ${totalActive} active filter${totalActive !== 1 ? 's' : ''}`
                }
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
