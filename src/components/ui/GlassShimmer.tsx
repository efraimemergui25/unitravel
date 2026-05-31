'use client';

import { motion } from 'framer-motion';

export interface GlassShimmerProps {
  height?:    number | string;
  width?:     number | string;
  delay?:     number;
  className?: string;
  style?:     React.CSSProperties;
}

export function GlassShimmer({ height, width, delay = 0, className = '', style }: GlassShimmerProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        height,
        width,
        background:           'rgba(255,255,255,0.55)',
        backdropFilter:       'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border:               '1px solid rgba(255,255,255,0.85)',
        boxShadow:            '0 4px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
        ...style,
      }}
    >
      {/* Base pulse — subtle opacity breathing */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay }}
        style={{ background: 'rgba(255,255,255,0.3)' }}
      />

      {/* Light sweep — primary effect */}
      {/* A bright angled band travels left-to-right (physically: start→end) */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.85) 50%, transparent 80%)',
          willChange: 'transform',
        }}
        animate={{ x: ['-110%', '110%'] }}
        transition={{
          duration:    1.8,
          repeat:      Infinity,
          ease:        'easeInOut',
          delay:       delay + 0.3,
          repeatDelay: 1.2,
        }}
      />

      {/* Content skeleton lines (subtle) */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 gap-2.5 pointer-events-none">
        <div className="h-3 rounded-full" style={{ background: 'rgba(0,0,0,0.05)', width: '65%' }} />
        <div className="h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.04)', width: '45%' }} />
        <div className="h-8 rounded-xl mt-2" style={{ background: 'rgba(0,0,0,0.04)', width: '40%' }} />
      </div>
    </div>
  );
}
