'use client';

import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExecState = 'executing' | 'done' | 'error';

export interface ExecutionPillProps {
  toolName: string;
  args:     Record<string, unknown>;
  state:    ExecState;
  result?:  unknown;
}

// ── Label map ─────────────────────────────────────────────────────────────────

const LABELS: Record<string, (a: Record<string, unknown>) => string> = {
  navigateWorkspace:    a => `Opening ${cap(a.zoneId as string)} Hub`,
  executeOmniSearch:    a => `Scanning 30 engines — ${a.origin} → ${a.destination}`,
  mutateTimeline:       a => `Placing "${a.title}" in timeline`,
  adjustFinancialModel: _  => 'Updating budget forecast',
  adjustDNA:            _  => 'Calibrating Travel DNA',
};

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function ExecutionPill({ toolName, args, state, result: _result }: ExecutionPillProps) {
  const label    = LABELS[toolName]?.(args) ?? toolName;
  const isDone   = state === 'done';
  const isError  = state === 'error';
  const color    = isError ? '#FF453A' : isDone ? '#30D158' : '#007AFF';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      style={{
        position:      'relative',
        display:       'flex',
        alignItems:    'center',
        gap:           9,
        paddingBlock:  8,
        paddingInline: 13,
        borderRadius:  999,
        background:    `${color}0D`,
        border:        `1.5px solid ${color}2A`,
        overflow:      'hidden',
        maxWidth:      290,
        alignSelf:     'flex-start',
        flexShrink:    0,
      }}
    >
      {/* Liquid shimmer sweep — only while executing */}
      {!isDone && !isError && (
        <motion.div
          aria-hidden
          style={{
            position:   'absolute',
            inset:      0,
            background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.68) 50%, transparent 80%)',
            pointerEvents: 'none',
          }}
          animate={{ x: ['-120%', '120%'] }}
          transition={{ duration: 1.55, repeat: Infinity, ease: [0.4, 0, 0.2, 1], repeatDelay: 0.55 }}
        />
      )}

      {/* Icon — spinning ✦ while executing, ✓/✕ when done */}
      <AnimatePresence mode="wait">
        {!isDone && !isError ? (
          <motion.span
            key="spin"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
            style={{ fontSize: 10, color, display: 'inline-block', flexShrink: 0, lineHeight: 1 }}
            aria-hidden
          >
            ✦
          </motion.span>
        ) : (
          <motion.span
            key="result-icon"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            style={{ fontSize: 11, color, flexShrink: 0, lineHeight: 1, fontWeight: 700 }}
            aria-hidden
          >
            {isError ? '✕' : '✓'}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Label */}
      <span
        style={{
          fontSize:     11,
          fontWeight:   700,
          color,
          letterSpacing: '-0.01em',
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          lineHeight:   1.3,
        }}
      >
        {label}
      </span>

      {/* Done pulse ring */}
      {isDone && (
        <motion.div
          aria-hidden
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{
            position:     'absolute',
            insetInlineStart: 10,
            width:        10,
            height:       10,
            borderRadius: '50%',
            border:       `1.5px solid ${color}`,
            pointerEvents: 'none',
          }}
        />
      )}
    </motion.div>
  );
}
