'use client';

import { memo }            from 'react';
import { motion }          from 'framer-motion';
import { useLocaleEngine } from '@/store/useLocaleEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EffortLevel = 'easy' | 'moderate' | 'challenging' | 'extreme';

export interface EffortOption {
  id:      EffortLevel;
  icon:    string;
  label:   string;
  labelHe: string;
  color:   string;
}

const EFFORT_OPTIONS: EffortOption[] = [
  { id: 'easy',        icon: '🚶', label: 'Easy Walk',    labelHe: 'הליכה קלה',    color: '#30D158' },
  { id: 'moderate',    icon: '🚴', label: 'Moderate',     labelHe: 'בינוני',        color: '#FF9F0A' },
  { id: 'challenging', icon: '🧗', label: 'Challenging',  labelHe: 'מאתגר',         color: '#FF453A' },
  { id: 'extreme',     icon: '🏔', label: 'Extreme Hike', labelHe: 'טיפוס קיצוני', color: '#BF5AF2' },
];

const SPRING = { type: 'spring', stiffness: 440, damping: 26 } as const;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EffortFilterProps {
  selected:   EffortLevel[];
  onChange:   (levels: EffortLevel[]) => void;
}

// ── Effort chip ───────────────────────────────────────────────────────────────

const EffortChip = memo(function EffortChip({
  option, isSelected, isHe, onToggle,
}: {
  option:     EffortOption;
  isSelected: boolean;
  isHe:       boolean;
  onToggle:   () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isSelected}
      whileHover={{ scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.93 }}
      animate={{
        background: isSelected ? `${option.color}16` : 'rgba(0,0,0,0.04)',
        boxShadow:  isSelected
          ? `0 0 0 1.5px ${option.color}50, inset 0 1px 0 rgba(255,255,255,0.7)`
          : '0 0 0 1px rgba(0,0,0,0.08)',
      }}
      transition={SPRING}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           5,
        paddingBlock:  7,
        paddingInline: 11,
        borderRadius:  11,
        border:        'none',
        cursor:        'pointer',
        flexShrink:    0,
        fontFamily:    'inherit',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{option.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'start' }}>
        <span style={{
          fontSize:      10.5,
          fontWeight:    isSelected ? 800 : 600,
          color:         isSelected ? option.color : '#3C3C43',
          letterSpacing: '-0.01em',
          whiteSpace:    'nowrap',
        }}>
          {isHe ? option.labelHe : option.label}
        </span>
      </div>

      {isSelected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={SPRING}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background: option.color, flexShrink: 0,
          }}
          aria-hidden
        />
      )}
    </motion.button>
  );
});

// ── Main export ───────────────────────────────────────────────────────────────

export function EffortFilter({ selected, onChange }: EffortFilterProps) {
  const { profile } = useLocaleEngine();
  const isHe        = profile.locale === 'he-IL';

  const toggle = (id: EffortLevel) => {
    onChange(
      selected.includes(id)
        ? selected.filter(v => v !== id)
        : [...selected, id],
    );
  };

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        10,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize:      9, fontWeight: 700,
        color:         'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        whiteSpace:    'nowrap', flexShrink: 0,
      }}>
        {isHe ? 'מאמץ' : 'Effort'}
      </span>

      <div style={{
        display:         'flex',
        gap:             6,
        overflowX:       'auto',
        scrollbarWidth:  'none',
        msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
        paddingBlock:    2,
      } as React.CSSProperties}>
        {EFFORT_OPTIONS.map(opt => (
          <EffortChip
            key={opt.id}
            option={opt}
            isSelected={selected.includes(opt.id)}
            isHe={isHe}
            onToggle={() => toggle(opt.id)}
          />
        ))}
      </div>

      {selected.length > 0 && (
        <span style={{
          fontSize:      9.5, fontWeight: 600,
          color:         'var(--text-secondary)',
          flexShrink:    0,
          letterSpacing: '-0.01em',
        }}>
          {isHe ? `${selected.length} נבחרו` : `${selected.length} selected`}
        </span>
      )}
    </div>
  );
}
