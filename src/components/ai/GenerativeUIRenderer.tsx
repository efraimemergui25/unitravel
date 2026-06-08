'use client';

import { useMemo }             from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DynamicToolUIPart }  from 'ai';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING_POP = { type: 'spring', stiffness: 520, damping: 26 } as const;
const AZURE      = '#007AFF';
const GREEN      = '#30D158';
const AMBER      = '#FF9F0A';
const VIOLET     = '#BF5AF2';
const RED        = '#FF453A';

const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  navigateWorkspace:    { icon: '🧭', label: 'Navigating',     color: AZURE   },
  executeOmniSearch:    { icon: '🔍', label: 'Scanning',       color: VIOLET  },
  commitToTimeline:     { icon: '📌', label: 'Committing',     color: GREEN   },
  mutateTimeline:       { icon: '✦',  label: 'Suggesting',     color: AZURE   },
  adjustFinancialModel: { icon: '💰', label: 'Updating budget',color: AMBER   },
  adjustDNA:            { icon: '🧬', label: 'Learning DNA',   color: VIOLET  },
};

// ── Scanning progress dots ─────────────────────────────────────────────────────

function ScanningDots({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: color }}
        />
      ))}
    </div>
  );
}

// ── Executing state — generic glass pill ──────────────────────────────────────

function ExecutingWidget({ dp }: { dp: DynamicToolUIPart }) {
  const meta  = TOOL_META[dp.toolName] ?? { icon: '⚙', label: dp.toolName, color: AZURE };
  const input = dp.input as Record<string, unknown> | undefined;

  const detail = useMemo(() => {
    if (dp.toolName === 'executeOmniSearch') {
      const dest = (input?.destination ?? input?.origin ?? '') as string;
      const cat  = (input?.category ?? 'results') as string;
      return dest ? `${cat} near ${dest}` : cat;
    }
    if (dp.toolName === 'navigateWorkspace') {
      return (input?.zoneId ?? '') as string;
    }
    if (dp.toolName === 'commitToTimeline') {
      return (input?.title ?? '') as string;
    }
    return '';
  }, [dp.toolName, input]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={SPRING_POP}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  10,
        paddingBlock:         9,
        paddingInline:        14,
        borderRadius:         14,
        background:           `${meta.color}08`,
        border:               `1.5px solid ${meta.color}25`,
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:            `0 3px 12px ${meta.color}10, inset 0 1px 0 rgba(255,255,255,0.8)`,
        maxWidth:             300,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, letterSpacing: '-0.01em', fontFamily: 'inherit' }}>
          {meta.label}{detail ? `: ${detail}` : ''}
        </div>
      </div>
      <ScanningDots color={meta.color} />
    </motion.div>
  );
}

// ── Search results widget ─────────────────────────────────────────────────────

function SearchResultsWidget({ dp }: { dp: DynamicToolUIPart }) {
  const output = dp.output as {
    category: string;
    count: number;
    distilledTop3: Array<{ title: string; price: number; subtitle?: string; aiScore?: number }>;
    sourcesQueried: number;
    successfulSources: number;
  } | undefined;

  if (!output) return null;
  const top3 = output.distilledTop3 ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_POP}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 300 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ fontSize: 12 }}
        >
          ✅
        </motion.div>
        <span style={{ fontSize: 10, fontWeight: 700, color: VIOLET, fontFamily: 'inherit' }}>
          {output.count} {output.category} found via {output.successfulSources}/{output.sourcesQueried} engines
        </span>
      </div>

      {/* Top 3 mini cards */}
      {top3.slice(0, 3).map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...SPRING_POP, delay: i * 0.07 }}
          style={{
            display:              'flex',
            alignItems:           'center',
            gap:                  9,
            paddingBlock:         7,
            paddingInline:        10,
            borderRadius:         12,
            background:           'rgba(255,255,255,0.40)',
            backdropFilter:       'blur(16px) saturate(1.7)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.7)',
            border:               '1.5px solid rgba(255,255,255,0.65)',
            boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#8E8E93', flexShrink: 0 }}>
            #{i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </div>
            {item.subtitle && (
              <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 1 }}>{item.subtitle}</div>
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 900, color: VIOLET, letterSpacing: '-0.02em', flexShrink: 0 }}>
            ${item.price?.toLocaleString() ?? '—'}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Timeline commit confirmation ───────────────────────────────────────────────

function CommitConfirmWidget({ dp }: { dp: DynamicToolUIPart }) {
  const output = dp.output as {
    committed: boolean; title: string; targetDayId: string; price: number; category: string;
  } | undefined;

  if (!output?.committed) return null;

  const dayNum = output.targetDayId.replace('day-', '');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_POP}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  10,
        paddingBlock:         9,
        paddingInline:        14,
        borderRadius:         14,
        background:           `${GREEN}10`,
        border:               `1.5px solid ${GREEN}30`,
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:            `0 0 12px ${GREEN}15, inset 0 1px 0 rgba(255,255,255,0.9)`,
        maxWidth:             300,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          width:          28, height: 28, borderRadius: 8,
          background:     `${GREEN}18`, border: `1px solid ${GREEN}30`,
          display:        'flex', alignItems: 'center', justifyContent: 'center',
          fontSize:       14, flexShrink: 0,
        }}
      >
        ✓
      </motion.div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: GREEN, letterSpacing: '-0.02em', fontFamily: 'inherit' }}>
          Added to Day {dayNum}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em', fontFamily: 'inherit' }}>
          {output.title} · ${output.price.toLocaleString()}
        </div>
      </div>
    </motion.div>
  );
}

// ── Navigation done widget ────────────────────────────────────────────────────

function NavigatedWidget({ dp }: { dp: DynamicToolUIPart }) {
  const output = dp.output as { zoneId: string } | undefined;
  if (!output) return null;

  const ZONE_LABELS: Record<string, string> = {
    flights: 'Aviation', lodging: 'Lodging', dining: 'Dining',
    attractions: 'Attractions', transit: 'Transit',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SPRING_POP}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        paddingBlock: 6, paddingInline: 12,
        borderRadius: 10,
        background: `${AZURE}08`, border: `1px solid ${AZURE}20`,
        fontSize: 10.5, fontWeight: 700, color: AZURE, fontFamily: 'inherit',
        maxWidth: 220,
      }}
    >
      <span>🧭</span>
      <span>Opened {ZONE_LABELS[output.zoneId] ?? output.zoneId}</span>
    </motion.div>
  );
}

// ── Error widget ──────────────────────────────────────────────────────────────

function ErrorWidget({ dp }: { dp: DynamicToolUIPart }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        paddingBlock: 7, paddingInline: 12,
        borderRadius: 10,
        background: `${RED}08`, border: `1px solid ${RED}20`,
        fontSize: 10.5, fontWeight: 600, color: RED,
        fontFamily: 'inherit', maxWidth: 260,
      }}
    >
      ⚠ {dp.toolName} encountered an error
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GenerativeUIRendererProps {
  part: DynamicToolUIPart;
}

export function GenerativeUIRenderer({ part }: GenerativeUIRendererProps) {
  const dp = part;

  if (dp.state === 'output-error' || dp.state === 'output-denied') {
    return <ErrorWidget dp={dp} />;
  }

  // Tool-specific completed widgets
  if (dp.state === 'output-available') {
    switch (dp.toolName) {
      case 'executeOmniSearch':
        return <SearchResultsWidget dp={dp} />;
      case 'commitToTimeline':
        return <CommitConfirmWidget dp={dp} />;
      case 'navigateWorkspace':
        return <NavigatedWidget dp={dp} />;
      case 'adjustFinancialModel':
      case 'adjustDNA':
        return null; // Silent — no UI needed for these
      default:
        return null;
    }
  }

  // Executing state (input-available but no output yet)
  return <ExecutingWidget dp={dp} />;
}
