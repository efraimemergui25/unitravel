'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import type { PeerCursor } from '@/store/useMultiplayerStore';

// ── PeerCursorPin ─────────────────────────────────────────────────────────────
// Uses MotionValues + useSpring so position updates bypass React's render cycle.
// Only opacity/scale entrance/exit trigger React re-renders.

function PeerCursorPin({ peer }: { peer: PeerCursor }) {
  const rawX   = useMotionValue(peer.x);
  const rawY   = useMotionValue(peer.y);
  const springX = useSpring(rawX, { stiffness: 400, damping: 28 });
  const springY = useSpring(rawY, { stiffness: 400, damping: 28 });

  useEffect(() => {
    rawX.set(peer.x);
    rawY.set(peer.y);
  }, [peer.x, peer.y, rawX, rawY]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{
        position:         'fixed',
        insetBlockStart:  0,
        insetInlineStart: 0,
        x:                springX,
        y:                springY,
        pointerEvents:    'none',
        zIndex:           9999,
      }}
    >
      {/* Cursor teardrop */}
      <div
        style={{
          width:        14,
          height:       14,
          borderRadius: '50% 50% 50% 0',
          background:   peer.color,
          transform:    'rotate(-45deg)',
          boxShadow:    `0 2px 10px ${peer.color}66`,
        }}
      />

      {/* Name pill */}
      <div
        style={{
          marginBlockStart:  8,
          marginInlineStart: 8,
          paddingBlock:      3,
          paddingInline:     9,
          borderRadius:      999,
          background:        'rgba(255,255,255,0.90)',
          backdropFilter:    'blur(20px)',
          border:            `1px solid ${peer.color}44`,
          boxShadow:         '0 2px 12px rgba(0,0,0,0.10)',
          fontSize:          11,
          fontWeight:        700,
          color:             peer.color,
          whiteSpace:        'nowrap',
          letterSpacing:     '-0.01em',
        }}
      >
        {peer.name}
      </div>
    </motion.div>
  );
}

// ── LiveCursors ───────────────────────────────────────────────────────────────

export function LiveCursors() {
  const { peers, initChannel, destroyChannel, broadcastCursor } = useMultiplayerStore();

  // Init the BroadcastChannel on mount
  useEffect(() => {
    initChannel();
    return () => destroyChannel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast own cursor position at rAF rate (no more than 60fps)
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (rafRef.current !== null) return;
      const x = e.clientX;
      const y = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
        broadcastCursor(x, y, null);
        rafRef.current = null;
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [broadcastCursor]);

  const now = Date.now();
  const activePeers = Object.values(peers).filter(
    p => p.id !== useMultiplayerStore.getState().myId && now - p.lastSeen < 8_000,
  );

  if (activePeers.length === 0) return null;

  return (
    <AnimatePresence>
      {activePeers.map(peer => (
        <PeerCursorPin key={peer.id} peer={peer} />
      ))}
    </AnimatePresence>
  );
}
