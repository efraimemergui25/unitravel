'use client';

import { memo }                     from 'react';
import { motion, AnimatePresence }  from 'framer-motion';
import { useLocaleEngine }          from '@/store/useLocaleEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#FF9F0A';
const SPRING = { type: 'spring', stiffness: 440, damping: 24 } as const;

// ── Vibe definitions ──────────────────────────────────────────────────────────

export interface VibeOption {
  id:          string;
  icon:        string;
  label:       string;
  labelHe:     string;
  color:       string;
  gradient:    string;
}

export const VIBE_OPTIONS: VibeOption[] = [
  { id: 'honeymoon-romantic', icon: '🌹', label: 'Honeymoon Romantic', labelHe: 'רומנטי לירח דבש',    color: '#FF2D55', gradient: 'linear-gradient(135deg, #FF2D55, #FF9F0A)' },
  { id: 'fine-dining',        icon: '🔥', label: 'Omakase & Fine Dining',  labelHe: 'אוכל עדין',     color: '#FF453A', gradient: 'linear-gradient(135deg, #FF453A, #FF9F0A)' },
  { id: 'high-energy-party',  icon: '🎉', label: 'High-Energy Party',  labelHe: 'מסיבה ואנרגיה',     color: '#BF5AF2', gradient: 'linear-gradient(135deg, #BF5AF2, #FF2D55)' },
  { id: 'sunset-beachside',   icon: '🌊', label: 'Beachside & Sunset', labelHe: 'שקיעה על החוף',     color: '#007AFF', gradient: 'linear-gradient(135deg, #007AFF, #00C7BE)' },
  { id: 'culinary-experience',icon: '🎨', label: 'Culinary Journey',   labelHe: 'חוויה קולינרית',    color: '#30D158', gradient: 'linear-gradient(135deg, #30D158, #007AFF)' },
  { id: 'business-lunch',     icon: '👔', label: 'Business Lunch',     labelHe: 'ארוחת עסקים',       color: '#5E5CE6', gradient: 'linear-gradient(135deg, #5E5CE6, #007AFF)' },
  { id: 'wellness-clean',     icon: '🌿', label: 'Wellness & Clean',   labelHe: 'בריאות ואורגני',    color: '#00C7BE', gradient: 'linear-gradient(135deg, #00C7BE, #30D158)' },
  { id: 'celebration',        icon: '🥂', label: 'Celebration',        labelHe: 'חגיגה',             color: '#FF9F0A', gradient: 'linear-gradient(135deg, #FF9F0A, #FF453A)' },
];

// ── Dietary definitions ───────────────────────────────────────────────────────

export interface DietOption {
  id:      string;
  icon:    string;
  label:   string;
  labelHe: string;
}

export const DIET_OPTIONS: DietOption[] = [
  { id: 'omnivore',    icon: '🥩', label: 'Omnivore',      labelHe: 'כל מאכל'   },
  { id: 'vegan',       icon: '🥬', label: 'Vegan',         labelHe: 'טבעוני'    },
  { id: 'vegetarian',  icon: '🥚', label: 'Vegetarian',    labelHe: 'צמחוני'    },
  { id: 'pescatarian', icon: '🐟', label: 'Pescatarian',   labelHe: 'פסקטריאני' },
  { id: 'kosher',      icon: '✡️', label: 'Kosher',        labelHe: 'כשר'       },
  { id: 'halal',       icon: '☪️', label: 'Halal',         labelHe: 'חלאל'      },
  { id: 'gluten-free', icon: '🌾', label: 'Gluten-Free',   labelHe: 'ללא גלוטן' },
  { id: 'nut-free',    icon: '🥜', label: 'Nut-Free',      labelHe: 'ללא אגוזים'},
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CulinaryFiltersProps {
  selectedVibes: string[];
  selectedDiets: string[];
  onVibesChange: (vibes: string[]) => void;
  onDietsChange: (diets: string[]) => void;
}

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
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        background:  isSelected ? vibe.gradient : 'rgba(255,255,255,0.72)',
        boxShadow:   isSelected
          ? `0 4px 18px ${vibe.color}38, 0 0 0 1.5px ${vibe.color}50`
          : '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.07)',
      }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        paddingBlock:   8,
        paddingInline:  11,
        borderRadius:   12,
        border:         'none',
        cursor:         'pointer',
        flexShrink:     0,
        fontFamily:     'inherit',
        backdropFilter: isSelected ? 'none' : 'blur(12px)',
        WebkitBackdropFilter: isSelected ? 'none' : 'blur(12px)',
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

      {/* Selection ring pulse */}
      <AnimatePresence>
        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              flexShrink: 0,
            }}
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
        background: isSelected ? `${COLOR}14` : 'rgba(0,0,0,0.04)',
        boxShadow:  isSelected
          ? `0 0 0 1.5px ${COLOR}48, inset 0 1px 0 rgba(255,255,255,0.7)`
          : '0 0 0 1px rgba(0,0,0,0.08)',
      }}
      transition={SPRING}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           5,
        paddingBlock:  6,
        paddingInline: 10,
        borderRadius:  10,
        border:        'none',
        cursor:        'pointer',
        flexShrink:    0,
        fontFamily:    'inherit',
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

// ── Main export ───────────────────────────────────────────────────────────────

export function CulinaryFilters({
  selectedVibes,
  selectedDiets,
  onVibesChange,
  onDietsChange,
}: CulinaryFiltersProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display:              'flex',
        flexDirection:        'column',
        gap:                  10,
        paddingInline:        20,
        paddingBlock:         12,
        background:           'rgba(255,255,255,0.72)',
        backdropFilter:       'blur(32px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(32px) saturate(1.9)',
        borderBlockEnd:       '1px solid rgba(0,0,0,0.05)',
        flexShrink:           0,
      }}
    >
      {/* ── Vibe row ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize:      9, fontWeight: 700,
          color:         'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          whiteSpace:    'nowrap', flexShrink: 0,
        }}>
          {isHe ? 'חוויה' : 'Vibe'}
        </span>
        <div style={{
          display:    'flex',
          gap:        6,
          overflowX:  'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
          paddingBlock: 2,
        } as React.CSSProperties}>
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

      {/* ── Diet row ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize:      9, fontWeight: 700,
          color:         'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          whiteSpace:    'nowrap', flexShrink: 0,
        }}>
          {isHe ? 'תזונה' : 'Diet'}
        </span>
        <div style={{
          display:    'flex',
          gap:        5,
          overflowX:  'auto',
          scrollbarWidth: 'none',
          paddingBlock: 2,
        }}>
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

      {/* Active summary badge */}
      <AnimatePresence>
        {(selectedVibes.length > 0 || selectedDiets.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
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
                ? `AI מסנן: ${selectedVibes.length + selectedDiets.length} פילטרים פעילים`
                : `AI filtering: ${selectedVibes.length + selectedDiets.length} active filter${selectedVibes.length + selectedDiets.length !== 1 ? 's' : ''}`
              }
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
