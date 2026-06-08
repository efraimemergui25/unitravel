'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerEngine }    from '@/store/useMultiplayerEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 520, damping: 30 } as const;

// ── Peer cursor ───────────────────────────────────────────────────────────────

function PeerCursor({ x, y, color, displayName }: {
  x: number; y: number; color: string; displayName: string;
}) {
  return (
    <motion.div
      style={{
        position:      'absolute',
        insetBlockStart:  y,
        insetInlineStart: x,
        pointerEvents:    'none',
        zIndex:           9999,
        transform:        'translate(-2px, -2px)',
      }}
      animate={{ top: y, left: x }}
      transition={{ ease: 'linear', duration: 0.075 }}
    >
      {/* SVG pointer */}
      <svg
        width={18}
        height={22}
        viewBox="0 0 18 22"
        fill="none"
        style={{ display: 'block', filter: `drop-shadow(0 2px 4px ${color}60)` }}
      >
        <path
          d="M1 1.5L1 17.5L5.5 13L8.5 20L10.5 19L7.5 12H14.5L1 1.5Z"
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>

      {/* Glass name tag */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING}
        style={{
          position:         'absolute',
          insetBlockStart:  16,
          insetInlineStart: 14,
          paddingBlock:     3,
          paddingInline:    8,
          borderRadius:     6,
          background:       'rgba(255,255,255,0.40)',
          backdropFilter:   'blur(12px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.8)',
          border:           '1px solid rgba(255,255,255,0.60)',
          boxShadow:        'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.08)',
          whiteSpace:       'nowrap',
          fontSize:         10,
          fontWeight:       700,
          color,
          letterSpacing:    '-0.01em',
          fontFamily:       'inherit',
          userSelect:       'none',
          WebkitUserSelect: 'none',
        }}
      >
        {displayName}
      </motion.div>
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MultiplayerCanvasProps {
  children:  ReactNode;
  className?: string;
  style?:     React.CSSProperties;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MultiplayerCanvas({ children, className, style }: MultiplayerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { peers, isConnected, broadcastCursor, connect } = useMultiplayerEngine();

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected) connect();
  }, [isConnected, connect]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isConnected) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    broadcastCursor(x, y);
  }, [isConnected, broadcastCursor]);

  const activePeers = Object.values(peers).filter(p => p.cursor !== null);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', ...style }}
      onMouseMove={handleMouseMove}
    >
      {children}

      {/* Render peer cursors — absolutely positioned within this container */}
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
