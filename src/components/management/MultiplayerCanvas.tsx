'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence }    from 'framer-motion';
import { useMultiplayerEngine }       from '@/store/useMultiplayerEngine';

// ── Peer cursor ───────────────────────────────────────────────────────────────

function PeerCursor({ x, y, color, displayName }: {
  x: number; y: number; color: string; displayName: string;
}) {
  return (
    <motion.div
      // Use CSS transforms (x/y) so physical top/left stay at 0 — avoids
      // the insetBlockStart vs animate({ top }) conflict.
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        pointerEvents: 'none',
        zIndex:        9999,
      }}
      animate={{ x, y }}
      transition={{ ease: 'linear', duration: 0.075 }}
    >
      {/* Bespoke SVG pointer */}
      <svg
        width={18}
        height={22}
        viewBox="0 0 18 22"
        fill="none"
        style={{ display: 'block', filter: `drop-shadow(0 2px 6px ${color}70)` }}
      >
        <path
          d="M1 1.5L1 17.5L5.5 13L8.5 20L10.5 19L7.5 12H14.5L1 1.5Z"
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>

      {/* Glass nametag — spec: px-2 py-1 rounded-md bg-white/40 backdrop-blur-md border border-white/60 text-xs font-semibold shadow-lg */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 4 }}
        animate={{ opacity: 1, scale: 1,   y: 0 }}
        exit={{    opacity: 0, scale: 0.8,  y: 4 }}
        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
        className="px-2 py-1 rounded-md bg-white/40 backdrop-blur-md border border-white/60 text-xs font-semibold shadow-lg"
        style={{
          position:  'absolute',
          top:       16,
          left:      14,
          color,
          whiteSpace:    'nowrap',
          letterSpacing: '-0.01em',
          fontFamily:    'inherit',
          userSelect:    'none',
          // Extra depth
          boxShadow: `0 2px 10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)`,
        }}
      >
        {displayName}
      </motion.div>
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MultiplayerCanvasProps {
  children:   ReactNode;
  className?: string;
  style?:     React.CSSProperties;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MultiplayerCanvas({ children, className, style }: MultiplayerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { peers, isConnected, broadcastPointer, connect } = useMultiplayerEngine();

  useEffect(() => {
    if (!isConnected) connect();
  }, [isConnected, connect]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isConnected) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    broadcastPointer(e.clientX - rect.left, e.clientY - rect.top);
  }, [isConnected, broadcastPointer]);

  const activePeers = Object.values(peers).filter(p => p.cursor !== null);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      onMouseMove={handleMouseMove}
    >
      {children}

      <AnimatePresence>
        {activePeers.map(peer => peer.cursor && (
          <PeerCursor
            key={peer.id}
            x={peer.cursor.x}
            y={peer.cursor.y}
            color={peer.color}
            displayName={peer.displayName}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
