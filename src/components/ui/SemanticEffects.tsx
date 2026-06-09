'use client';

/**
 * SemanticEffects — physics-based micro-interaction components.
 *
 * SparkleButton  — wraps a button; on click, emits sparkle particles
 * PriceTicker    — displays a price that animates (ticks up/down) on change
 * SuccessRing    — confirms a booking with an expanding ring
 */

import { useState, useRef, useCallback, useEffect, ReactNode, useMemo } from 'react';
import { motion, AnimatePresence }                              from 'framer-motion';

// ── Sparkle particle ──────────────────────────────────────────────────────────

interface Particle {
  id:    number;
  x:     number;
  y:     number;
  angle: number;
  dist:  number;
  color: string;
  size:  number;
}

const SPARKLE_COLORS = ['#007AFF', '#5E5CE6', '#30D158', '#FF9F0A', '#BF5AF2', '#5AC8FA'];

function SparkleParticles({ particles }: { particles: Particle[] }) {
  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            position: 'absolute',
            left: p.x,
            top:  p.y,
            width:  p.size,
            height: p.size,
            borderRadius: '50%',
            background:   p.color,
            boxShadow:    `0 0 ${p.size * 2}px ${p.color}`,
            pointerEvents: 'none',
            zIndex: 999,
          }}
        />
      ))}
    </>
  );
}

// ── SparkleButton ─────────────────────────────────────────────────────────────

export function SparkleButton({
  children,
  onClick,
  disabled,
  style,
  className,
}: {
  children:  ReactNode;
  onClick?:  () => void;
  disabled?: boolean;
  style?:    React.CSSProperties;
  className?: string;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const ref = useRef<HTMLButtonElement>(null);
  let pid = useRef(0);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;

    // Emit sparkles from click point
    const rect = ref.current?.getBoundingClientRect();
    const cx   = rect ? e.clientX - rect.left : 0;
    const cy   = rect ? e.clientY - rect.top  : 0;

    const newParticles: Particle[] = Array.from({ length: 10 }, (_, i) => ({
      id:    ++pid.current,
      x:     cx,
      y:     cy,
      angle: (i / 10) * 2 * Math.PI + (Math.random() - 0.5) * 0.5,
      dist:  24 + Math.random() * 20,
      color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
      size:  2 + Math.random() * 3,
    }));

    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.find(n => n.id === p.id))), 700);

    onClick?.();
  }, [disabled, onClick]);

  return (
    <button
      ref={ref}
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{ position: 'relative', overflow: 'visible', ...style }}
    >
      {children}
      <SparkleParticles particles={particles} />
    </button>
  );
}

// ── PriceTicker ───────────────────────────────────────────────────────────────

export function PriceTicker({
  value,
  currency = '$',
  style,
  tickColor,
}: {
  value:      number;
  currency?:  string;
  style?:     React.CSSProperties;
  tickColor?: string;
}) {
  const prevRef   = useRef(value);
  const [key, setKey] = useState(0);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value !== prevRef.current) {
      setDir(value > prevRef.current ? 'up' : 'down');
      setKey(k => k + 1);
      prevRef.current = value;
      const t = setTimeout(() => setDir(null), 400);
      return () => clearTimeout(t);
    }
  }, [value]);

  const color = dir === 'up' ? (tickColor ?? '#FF453A') : dir === 'down' ? '#30D158' : undefined;

  return (
    <motion.span
      key={key}
      initial={{ y: dir === 'up' ? 8 : dir === 'down' ? -8 : 0, opacity: dir ? 0 : 1 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        display: 'inline-block',
        color,
        transition: 'color 0.3s ease',
        ...style,
      }}
    >
      {currency}{value.toLocaleString()}
    </motion.span>
  );
}

// ── SuccessRing ───────────────────────────────────────────────────────────────

export function SuccessRing({
  trigger,
  color = '#30D158',
  children,
  style,
}: {
  trigger:   boolean;
  color?:    string;
  children:  ReactNode;
  style?:    React.CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', ...style }}>
      {children}
      <AnimatePresence>
        {trigger && (
          <motion.div
            key="ring"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: -4,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── BookingConfetti ───────────────────────────────────────────────────────────

export function BookingConfetti({ active }: { active: boolean }) {
  const PIECES = 24;
  // Stable pseudo-random values — no Math.random() in render body
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    id:       i,
    x:        ((i * 4.17 + (i % 7) * 3.11) % 97) + 1.5,
    delay:    (i * 0.38) / PIECES,
    color:    SPARKLE_COLORS[i % SPARKLE_COLORS.length],
    size:     4 + (i % 4),
    rotate:   (i * 37) % 360,
    rotDir:   i % 2 === 0 ? 720 : -720,
    isCircle: i % 3 !== 0,
    duration: 1.7 + (i % 10) * 0.12,
  })), []);

  if (!active) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: p.rotate }}
          animate={{ y: '110vh', opacity: [1, 1, 0.8, 0], rotate: p.rotate + p.rotDir }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            position: 'absolute', width: p.size, height: p.size,
            borderRadius: p.isCircle ? '50%' : 2,
            background: p.color,
            boxShadow: `0 0 ${p.size}px ${p.color}80`,
          }}
        />
      ))}
    </div>
  );
}
