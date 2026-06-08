'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerEngine }    from '@/store/useMultiplayerEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 520, damping: 24 } as const;

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        display:      'inline-block',
        width:        4, height: 4,
        borderRadius: '50%',
        background:   'currentColor',
        marginInline: 1.5,
      }}
    />
  );
}

function PeerTypingBadge({ name, color }: { name: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.92 }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            7,
        paddingBlock:   6,
        paddingInline:  10,
        borderRadius:   10,
        background:     'rgba(255,255,255,0.50)',
        backdropFilter: 'blur(16px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.8)',
        border:         '1px solid rgba(255,255,255,0.55)',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.06)',
        fontSize:       10.5,
        fontWeight:     600,
        color,
        letterSpacing:  '-0.01em',
        fontFamily:     'inherit',
        marginBlockEnd: 4,
      }}
    >
      {/* Color dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background:  color,
        boxShadow:   `0 0 5px ${color}99`,
        flexShrink:  0,
      }} />
      <span style={{ color: '#6E6E73', fontWeight: 500 }}>
        {name} is typing to AI
      </span>
      <span style={{ color, display: 'flex', alignItems: 'center' }}>
        <TypingDot delay={0} />
        <TypingDot delay={0.18} />
        <TypingDot delay={0.36} />
      </span>
    </motion.div>
  );
}

// ── Conflict toast — Dynamic Island style ─────────────────────────────────────

function ConflictToast({ peerName, dayId, entityTitle, onResolve }: {
  peerName:    string;
  dayId:       string;
  entityTitle: string;
  onResolve:   () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={SPRING_POP}
      style={{
        paddingBlock:   10,
        paddingInline:  14,
        borderRadius:   16,
        background:     'rgba(255,255,255,0.70)',
        backdropFilter: 'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:         '1.5px solid rgba(251,191,36,0.50)',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(251,191,36,0.15), 0 2px 8px rgba(0,0,0,0.06)',
        display:        'flex',
        flexDirection:  'column',
        gap:            4,
        marginBlockEnd: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <motion.span
          animate={{ rotate: [0, 12, -12, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ fontSize: 13, flexShrink: 0 }}
        >
          ⚡
        </motion.span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: '#B45309',
          letterSpacing: '-0.02em', fontFamily: 'inherit',
        }}>
          Timeline Conflict
        </span>
      </div>

      <p style={{
        margin: 0, fontSize: 10.5, fontWeight: 500,
        color: '#78716c', lineHeight: 1.5, fontFamily: 'inherit',
      }}>
        Both you and <strong style={{ color: '#92400e' }}>{peerName}</strong> are editing{' '}
        <strong style={{ color: '#92400e' }}>{dayId}</strong>.
        <br />Resolving <em>{entityTitle}</em> via merge.
      </p>

      <button
        onClick={onResolve}
        style={{
          alignSelf:      'flex-start',
          marginBlockStart: 2,
          paddingBlock:   3,
          paddingInline:  10,
          borderRadius:   7,
          border:         'none',
          background:     'rgba(251,191,36,0.15)',
          color:          '#B45309',
          fontSize:       10,
          fontWeight:     700,
          cursor:         'pointer',
          fontFamily:     'inherit',
          letterSpacing:  '-0.01em',
        }}
      >
        Dismiss
      </button>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CollaborativeIndicators() {
  const { peers, conflicts, resolveConflict } = useMultiplayerEngine();

  const typingPeers    = Object.values(peers).filter(p => p.isTypingAI);
  const activeConflicts = conflicts.filter(c => !c.resolvedAt);

  if (typingPeers.length === 0 && activeConflicts.length === 0) return null;

  return (
    <motion.div
      layout
      style={{
        paddingInline:  12,
        paddingBlock:   8,
        borderBlockEnd: '1px solid rgba(255,255,255,0.40)',
      }}
    >
      {/* Conflict toasts */}
      <AnimatePresence>
        {activeConflicts.map(c => (
          <ConflictToast
            key={c.id}
            peerName={c.peerName}
            dayId={c.dayId}
            entityTitle={c.entityTitle}
            onResolve={() => resolveConflict(c.id)}
          />
        ))}
      </AnimatePresence>

      {/* Typing indicators */}
      <AnimatePresence>
        {typingPeers.map(peer => (
          <PeerTypingBadge
            key={peer.id}
            name={peer.displayName}
            color={peer.color}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
