'use client';

/**
 * LiquidCard — Apple Liquid Glass-inspired card component.
 *
 * Features:
 * - Adaptive tint based on `accentColor` prop (destination color)
 * - Specular highlight that tracks cursor position (chromatic aberration)
 * - Depth shadow with color-matched glow
 * - Parallax tilt on hover (subtle 3D perspective)
 * - Animated border with specular top line
 */

import { useState, useRef, ReactNode } from 'react';
import { motion }                       from 'framer-motion';

interface LiquidCardProps {
  children:    ReactNode;
  accentColor?: string;           // hex color — tints the glass
  depth?:      'base' | 'elevated' | 'deep';  // glass layer
  interactive?: boolean;          // enables hover parallax
  padding?:    string | number;
  borderRadius?: number;
  style?:      React.CSSProperties;
  className?:  string;
  onClick?:    () => void;
}

const DEPTH_CONFIG = {
  base:     { blur: '32px', bg: 0.65, saturation: '180%', shadow: '0 4px 20px rgba(0,0,0,0.07)' },
  elevated: { blur: '48px', bg: 0.82, saturation: '200%', shadow: '0 8px 36px rgba(0,0,0,0.09)' },
  deep:     { blur: '64px', bg: 0.92, saturation: '220%', shadow: '0 16px 56px rgba(0,0,0,0.12)' },
};

export function LiquidCard({
  children,
  accentColor,
  depth = 'elevated',
  interactive = true,
  padding = '16px',
  borderRadius = 20,
  style,
  className,
  onClick,
}: LiquidCardProps) {
  const [lightX, setLightX] = useState(50);
  const [lightY, setLightY] = useState(30);
  const [rotX,   setRotX]   = useState(0);
  const [rotY,   setRotY]   = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const d = DEPTH_CONFIG[depth];

  // Parse accent color for tinting
  const accentRgb = accentColor
    ? hexToRgb(accentColor)
    : null;

  function handleMouseMove(e: React.MouseEvent) {
    if (!interactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x    = ((e.clientX - rect.left) / rect.width)  * 100;
    const y    = ((e.clientY - rect.top)  / rect.height) * 100;
    setLightX(x);
    setLightY(y);
    // Subtle tilt — max 2 degrees
    setRotY((x - 50) / 50 * 2);
    setRotX((y - 50) / 50 * -1.5);
  }

  function handleMouseLeave() {
    setLightX(50);
    setLightY(30);
    setRotX(0);
    setRotY(0);
  }

  const accentGlow = accentRgb
    ? `0 0 40px rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.12), `
    : '';

  const accentTint = accentRgb
    ? `radial-gradient(ellipse at ${lightX}% ${lightY}%, rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.07) 0%, transparent 60%), `
    : '';

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      animate={{ rotateX: rotX, rotateY: rotY }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius,
        padding,
        background: `${accentTint}rgba(255,255,255,${d.bg})`,
        backdropFilter: `blur(${d.blur}) saturate(${d.saturation})`,
        WebkitBackdropFilter: `blur(${d.blur}) saturate(${d.saturation})`,
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: `${accentGlow}${d.shadow}, inset 0 1.5px 0 rgba(255,255,255,1)`,
        transformStyle: 'preserve-3d',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      className={className}
    >
      {/* Chromatic aberration top-edge specular */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: '5%', right: '5%', top: 0, height: 1, zIndex: 4,
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(${accentRgb ? `${accentRgb.r},${accentRgb.g},${accentRgb.b}` : '255,255,255'},0.3) ${lightX - 10}%,
            rgba(255,255,255,1) ${lightX}%,
            rgba(${accentRgb ? `${accentRgb.r},${accentRgb.g},${accentRgb.b}` : '255,255,255'},0.3) ${lightX + 10}%,
            transparent 100%)`,
          transition: 'background 0.1s ease',
          borderRadius: 999,
          pointerEvents: 'none',
        }}
      />

      {/* Moving light orb — follows cursor */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${lightX}%`, top: `${lightY}%`,
          transform: 'translate(-50%, -50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: accentRgb
            ? `radial-gradient(circle, rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.08) 0%, transparent 70%)`
            : 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          transition: 'left 0.08s ease, top 0.08s ease',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </motion.div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}
