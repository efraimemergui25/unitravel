'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter }               from 'next/navigation';
import { AlertTriangle, Lightbulb } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransitGap {
  fromLabel:    string;  // e.g. "Flight arrives 14:00"
  toLabel:      string;  // e.g. "Hotel check-in 15:00"
  gapMinutes:   number;  // e.g. 60
  dayId:        string;
  insertAfter:  string;  // entity id after which to inject
}

interface Props {
  gap:       TransitGap;
  onDismiss: () => void;
  onInject?: (mode: 'uber' | 'train') => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 460, damping: 28 } as const;
const PURPLE = '#BF5AF2';
const BLUE   = '#007AFF';

function formatGap(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Micro action button ───────────────────────────────────────────────────────

function MicroButton({
  icon, label, sublabel, color, onClick, loading,
}: {
  icon:     string;
  label:    string;
  sublabel: string;
  color:    string;
  onClick:  () => void;
  loading?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{
        scale:      1.03,
        background: `${color}14`,
        borderColor: `${color}40`,
      }}
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  8,
        paddingBlock:         8,
        paddingInline:        12,
        borderRadius:         12,
        background:           `${color}09`,
        border:               `1px solid ${color}25`,
        cursor:               'pointer',
        fontFamily:           'inherit',
        flex:                 1,
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label={`${label} transit option`}
      aria-busy={loading}
    >
      <div style={{
        width:        28, height: 28, borderRadius: 8, flexShrink: 0,
        background:   `${color}18`,
        border:       `1px solid ${color}28`,
        display:      'flex', alignItems: 'center', justifyContent: 'center',
        fontSize:     14,
      }}>
        {loading ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'inline-block', fontSize: 11, color }}
          >
            ↻
          </motion.span>
        ) : icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'start' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: '#6E6E73', fontWeight: 500 }}>
          {sublabel}
        </span>
      </div>
    </motion.button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TransitNodeInjector({ gap, onDismiss, onInject }: Props) {
  const router               = useRouter();
  const [loading, setLoading] = useState<'uber' | 'train' | null>(null);
  const [injected, setInjected] = useState(false);

  const gapLabel   = formatGap(gap.gapMinutes);
  const isUrgent   = gap.gapMinutes < 30;
  const accentColor = isUrgent ? '#FF453A' : PURPLE;

  const handleInject = useCallback(async (mode: 'uber' | 'train') => {
    setLoading(mode);
    onInject?.(mode);

    // Navigate to transit zone with context pre-filled
    await new Promise(r => setTimeout(r, 350));
    setLoading(null);
    setInjected(true);

    await new Promise(r => setTimeout(r, 600));
    router.push(`/zone/transit?from=${encodeURIComponent(gap.fromLabel)}&to=${encodeURIComponent(gap.toLabel)}&mode=${mode}`);
  }, [gap, onInject, router]);

  return (
    <AnimatePresence mode="wait">
      {!injected ? (
        <motion.div
          key="injector"
          initial={{ opacity: 0, y: 10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{ opacity: 0, y: -8, scale: 0.90 }}
          transition={SPRING}
          style={{
            maxWidth:             320,
            background:           'rgba(255,255,255,0.52)',
            backdropFilter:       'blur(40px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
            border:               `1px solid rgba(255,255,255,0.70)`,
            padding:              12,
            borderRadius:         18,
            display:              'flex',
            flexDirection:        'column',
            gap:                  10,
            boxShadow:            `0 6px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)`,
            position:             'relative',
            overflow:             'hidden',
          }}
          role="dialog"
          aria-label="Transit gap detected"
        >
          {/* Urgency accent bar */}
          <div
            aria-hidden
            style={{
              position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, insetInlineEnd: 0,
              height: 2.5,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00)`,
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {/* Pulsing icon */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <motion.div
                animate={isUrgent ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: `${accentColor}16`,
                  border:     `1px solid ${accentColor}28`,
                  display:    'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize:   14,
                }}
              >
                🚦
              </motion.div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 11.5, fontWeight: 800,
                color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1.3,
              }}>
                Transit Gap Detected
              </p>
              <p style={{ margin: 0, marginBlockStart: 2, fontSize: 10, color: '#6E6E73', lineHeight: 1.4 }}>
                {gap.fromLabel} → {gap.toLabel}
              </p>
            </div>

            {/* Gap badge */}
            <div style={{
              paddingBlock:  3, paddingInline: 8,
              borderRadius:  999,
              background:    `${accentColor}14`,
              border:        `1px solid ${accentColor}28`,
              flexShrink:    0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: accentColor, letterSpacing: '-0.01em' }}>
                {gapLabel}
              </span>
            </div>

            {/* Dismiss */}
            <motion.button
              onClick={onDismiss}
              whileTap={{ scale: 0.88 }}
              style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(0,0,0,0.06)', border: 'none',
                cursor: 'pointer', fontSize: 10, color: '#AEAEB2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              ×
            </motion.button>
          </div>

          {/* Prompt */}
          <p style={{
            margin: 0, fontSize: 10.5, color: '#3C3C43',
            lineHeight: 1.5, letterSpacing: '-0.01em',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle', marginRight: 3 }}>
              {isUrgent
                ? <AlertTriangle size={10} color="#FF9500" strokeWidth={2.5} />
                : <Lightbulb     size={10} color="#007AFF" strokeWidth={2.5} />
              }
            </span>
            {isUrgent ? 'Tight window.' : 'Tip:'}
            {' '}Add logistics to your timeline?
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <MicroButton
              icon="🚗"
              label="Uber API"
              sublabel="~12 min · Estimate fare"
              color={BLUE}
              onClick={() => handleInject('uber')}
              loading={loading === 'uber'}
            />
            <MicroButton
              icon="🚇"
              label="Train Routes"
              sublabel="Public transit options"
              color={PURPLE}
              onClick={() => handleInject('train')}
              loading={loading === 'train'}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="injected"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={SPRING}
          style={{
            maxWidth:   320,
            paddingBlock: 12, paddingInline: 14,
            borderRadius: 18,
            background:  'rgba(48,209,88,0.10)',
            border:      '1px solid rgba(48,209,88,0.28)',
            display:     'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#30D158' }}>
            Transit options opening…
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
