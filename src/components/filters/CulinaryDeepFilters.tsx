'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useCulinarySync }                       from '@/store/useCulinarySync';
import { useLocaleEngine }                       from '@/store/useLocaleEngine';
import type { DietaryRestriction, DiningVibe, CuisineType } from '@/store/useCulinarySync';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const ORANGE     = '#FF9F0A';
const GRADIENT   = 'linear-gradient(135deg, #FF9F0A 0%, #FF2D55 100%)';
const GOLD       = '#F5C518';

// ── Dietary pills ─────────────────────────────────────────────────────────────

const DIETARY_META: Record<DietaryRestriction, { icon: string; color: string }> = {
  'Kosher':       { icon: '✡',  color: '#007AFF' },
  'Vegan':        { icon: '🌱', color: '#30D158' },
  'Vegetarian':   { icon: '🥦', color: '#30D158' },
  'Halal':        { icon: '☪',  color: '#00C7BE' },
  'Gluten-Free':  { icon: '🌾', color: '#FF9F0A' },
  'Pescatarian':  { icon: '🐟', color: '#007AFF' },
  'Nut-Free':     { icon: '🥜', color: '#FF453A' },
  'Dairy-Free':   { icon: '🥛', color: '#6E6E73' },
};

const VIBE_META: Record<DiningVibe, { icon: string; color: string }> = {
  'Romantic':    { icon: '🕯', color: '#FF2D55' },
  'High-Energy': { icon: '⚡', color: '#BF5AF2' },
  'Casual':      { icon: '😊', color: '#30D158' },
  'Business':    { icon: '💼', color: '#007AFF' },
  'Family':      { icon: '👨‍👩‍👧', color: '#FF9F0A' },
  'Solo':        { icon: '🎧', color: '#5E5CE6' },
};

function TagPill<T extends string>({
  value, label, icon, color, isActive, onToggle,
}: {
  value: T; label: string; icon: string; color: string;
  isActive: boolean; onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isActive}
      animate={{
        scale:      isActive ? 0.95 : 1,
        background: isActive ? `${color}18` : 'rgba(255,255,255,0.25)',
      }}
      whileHover={{ y: isActive ? 0 : -1 }}
      whileTap={{ scale: 0.93 }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        paddingBlock:   7,
        paddingInline:  12,
        borderRadius:   20,
        border:         isActive ? `1.5px solid ${color}45` : '1.5px solid rgba(255,255,255,0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow:      isActive
          ? `inset 0 3px 10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)`
          : 'inset 0 1px 0 rgba(255,255,255,0.80)',
        cursor:         'pointer',
        fontFamily:     'inherit',
        flexShrink:     0,
        userSelect:     'none',
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, color: isActive ? color : '#6E6E73', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </motion.button>
  );
}

// ── Michelin switch ───────────────────────────────────────────────────────────

function MichelinSwitch({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isOn}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        paddingBlock:   10,
        paddingInline:  16,
        borderRadius:   16,
        border:         isOn ? `1.5px solid rgba(245,197,24,0.50)` : '1.5px solid rgba(255,255,255,0.50)',
        background:     isOn ? 'rgba(245,197,24,0.10)' : 'rgba(255,255,255,0.22)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:      isOn
          ? 'inset 0 0 15px rgba(245,197,24,0.20), inset 0 1px 0 rgba(255,255,255,0.6)'
          : 'inset 0 1px 0 rgba(255,255,255,0.7)',
        cursor:         'pointer',
        fontFamily:     'inherit',
        flexShrink:     0,
      }}
    >
      {/* Michelin star icon */}
      <motion.span
        animate={{
          textShadow: isOn
            ? [`0 0 6px ${GOLD}cc`, `0 0 18px ${GOLD}ff`, `0 0 6px ${GOLD}cc`]
            : '0 0 0px transparent',
        }}
        transition={{ duration: 2, repeat: isOn ? Infinity : 0 }}
        style={{ fontSize: 20, lineHeight: 1, userSelect: 'none' }}
      >
        ⭐
      </motion.span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: isOn ? GOLD : '#1C1C1E', letterSpacing: '-0.02em', fontFamily: 'inherit' }}>
          Michelin Only
        </span>
        <span style={{ fontSize: 9, fontWeight: 500, color: '#6E6E73', fontFamily: 'inherit' }}>
          {isOn ? 'Filtering to rated restaurants' : 'Show all quality levels'}
        </span>
      </div>

      {/* Toggle track */}
      <div style={{
        width: 36, height: 20, borderRadius: 10,
        background: isOn ? `linear-gradient(90deg, ${GOLD}, #FF9F0A)` : 'rgba(0,0,0,0.12)',
        position: 'relative',
        boxShadow: isOn ? `0 0 10px ${GOLD}60` : 'none',
        transition: 'background 0.25s, box-shadow 0.25s',
        marginInlineStart: 4,
        flexShrink: 0,
      }}>
        <motion.div
          animate={{ insetInlineStart: isOn ? 18 : 2 }}
          transition={SPRING}
          style={{
            position:   'absolute',
            insetBlockStart: 2,
            width:      16, height: 16,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            boxShadow:  '0 1px 4px rgba(0,0,0,0.18)',
          }}
        />
      </div>
    </motion.button>
  );
}

// ── AI sync flash ─────────────────────────────────────────────────────────────

function AISyncFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={SPRING_POP}
          style={{ paddingBlock: 4, paddingInline: 10, borderRadius: 20, background: `${ORANGE}18`, border: `1px solid ${ORANGE}40`, fontSize: 9.5, fontWeight: 700, color: ORANGE, fontFamily: 'inherit', flexShrink: 0 }}
        >
          ✦ AI synced
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CulinaryDeepFilters() {
  const {
    filters, toggleDietary, toggleVibe,
    setMichelinOnly, lastAISyncAt,
  } = useCulinarySync();
  const { profile } = useLocaleEngine();
  const isRtl = profile.direction === 'rtl';

  const [showAIFlash, setShowAIFlash] = useState(false);

  useEffect(() => {
    if (!lastAISyncAt) return;
    setShowAIFlash(true);
    const t = setTimeout(() => setShowAIFlash(false), 2500);
    return () => clearTimeout(t);
  }, [lastAISyncAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.04 }}
      className="glass-panel mx-4 flex-shrink-0"
      style={{ direction: isRtl ? 'rtl' : 'ltr', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 12, paddingInline: 16, borderBlockEnd: '1px solid rgba(255,255,255,0.40)', flexWrap: 'wrap', rowGap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 4px 12px rgba(255,159,10,0.35)' }}>🍽</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Culinary Filters</div>
            <div style={{ fontSize: 9.5, color: '#6E6E73', fontWeight: 500 }}>AI-synced · real-time</div>
          </div>
        </div>
        <div style={{ marginInlineStart: 'auto' }}><AISyncFlash show={showAIFlash} /></div>
      </div>

      {/* Michelin switch */}
      <div style={{ paddingInline: 16, paddingBlock: 12, borderBlockEnd: '1px solid rgba(255,255,255,0.35)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <MichelinSwitch isOn={filters.michelinOnly} onToggle={() => setMichelinOnly(!filters.michelinOnly)} />
      </div>

      {/* Dietary pills */}
      <div style={{ paddingInline: 16, paddingBlock: 12, borderBlockEnd: '1px solid rgba(255,255,255,0.35)' }}>
        <p style={{ margin: 0, marginBlockEnd: 8, fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          Dietary
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {(Object.entries(DIETARY_META) as [DietaryRestriction, { icon: string; color: string }][]).map(([d, meta]) => (
            <TagPill
              key={d} value={d} label={d} icon={meta.icon} color={meta.color}
              isActive={filters.dietaryRestrictions.includes(d)}
              onToggle={() => toggleDietary(d)}
            />
          ))}
        </div>
      </div>

      {/* Vibe pills */}
      <div style={{ paddingInline: 16, paddingBlock: 12 }}>
        <p style={{ margin: 0, marginBlockEnd: 8, fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          Vibe
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {(Object.entries(VIBE_META) as [DiningVibe, { icon: string; color: string }][]).map(([v, meta]) => (
            <TagPill
              key={v} value={v} label={v} icon={meta.icon} color={meta.color}
              isActive={filters.vibes.includes(v)}
              onToggle={() => toggleVibe(v)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
