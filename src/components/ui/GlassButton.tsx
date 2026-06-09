'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassButtonProps {
  children:   ReactNode;
  onClick?:   () => void;
  variant?:   'primary' | 'ghost' | 'danger';
  className?: string;
  type?:      'button' | 'submit' | 'reset';
  disabled?:  boolean;
}

// ── Audit-enforced spring: stiffness 300 / damping 20 ────────────────────────
const SPRING = { type: 'spring', stiffness: 300, damping: 20 } as const;

// ── Base shadow (static, applied on mount) ────────────────────────────────────
const BASE_SHADOW: Record<NonNullable<GlassButtonProps['variant']>, string> = {
  primary: 'inset 0 2px 10px rgba(255,255,255,0.85), 0 4px 15px rgba(0,0,0,0.05)',
  ghost:   '0 2px 8px rgba(0,0,0,0.04)',
  danger:  'inset 0 2px 10px rgba(255,255,255,0.40), 0 4px 15px rgba(255,59,48,0.10)',
};

// ── Hover shadow — FM-animated inner glow intensification on spring lift ──────
const HOVER_SHADOW: Record<NonNullable<GlassButtonProps['variant']>, string> = {
  primary: 'inset 0 2px 14px rgba(255,255,255,1), 0 8px 28px rgba(0,0,0,0.09)',
  ghost:   'inset 0 1px 8px rgba(255,255,255,0.60), 0 6px 18px rgba(0,0,0,0.06)',
  danger:  'inset 0 2px 14px rgba(255,255,255,0.50), 0 8px 24px rgba(255,59,48,0.16)',
};

// ── Tailwind: structure + color only — NO shadow (Framer Motion owns that) ────
const TAILWIND: Record<NonNullable<GlassButtonProps['variant']>, string> = {
  primary:
    'px-6 py-3 rounded-full ' +
    'bg-white/40 backdrop-blur-md ' +
    'border border-white/80 ' +
    'text-slate-800 font-semibold ' +
    'active:scale-95',

  ghost:
    'px-6 py-3 rounded-full ' +
    'bg-white/10 backdrop-blur-md ' +
    'border border-white/30 ' +
    'text-slate-600 font-medium ' +
    'active:scale-95',

  danger:
    'px-6 py-3 rounded-full ' +
    'bg-red-500/20 backdrop-blur-md ' +
    'border border-red-300/40 ' +
    'text-red-700 font-semibold ' +
    'active:scale-95',
};

export function GlassButton({
  children,
  onClick,
  variant   = 'primary',
  className = '',
  type      = 'button',
  disabled  = false,
}: GlassButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${TAILWIND[variant]}
        ${className}
      `}
      // ── Base shadow lives here so Framer Motion can interpolate it ─────────
      style={{ boxShadow: BASE_SHADOW[variant] }}
      // ── Audit: y -2 spring lift + glow intensification on hover ───────────
      whileHover={disabled ? {} : {
        y:         -2,
        scale:      1.02,
        boxShadow: HOVER_SHADOW[variant],
      }}
      // ── Tactile depress — snaps back to y:0 ───────────────────────────────
      whileTap={disabled ? {} : {
        scale: 0.95,
        y:     0,
        boxShadow: BASE_SHADOW[variant],
      }}
      transition={SPRING}
    >
      {children}
    </motion.button>
  );
}
