'use client';

import { motion } from 'framer-motion';

export interface GlassShimmerProps {
  height?:    number | string;
  width?:     number | string;
  delay?:     number;
  /** 'default' = generic lines, 'hero-card' = aviation hero card layout */
  variant?:   'default' | 'hero-card';
  className?: string;
  style?:     React.CSSProperties;
}

export function GlassShimmer({
  height,
  width,
  delay = 0,
  variant = 'default',
  className = '',
  style,
}: GlassShimmerProps) {
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

      {/* Light sweep — ambient room light passing over frosted glass */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(105deg, transparent 18%, rgba(255,255,255,0.90) 50%, transparent 82%)',
          willChange: 'transform',
        }}
        animate={{ x: ['-115%', '115%'] }}
        transition={{
          duration:    1.9,
          repeat:      Infinity,
          ease:        [0.4, 0, 0.2, 1],
          delay:       delay + 0.25,
          repeatDelay: 1.3,
        }}
      />

      {/* Skeleton content */}
      {variant === 'hero-card' ? (
        <HeroCardSkeleton />
      ) : (
        <DefaultSkeleton />
      )}
    </div>
  );
}

// ── Default skeleton lines ────────────────────────────────────────────────────

function DefaultSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col justify-end p-5 gap-2.5 pointer-events-none">
      <div className="h-3 rounded-full" style={{ background: 'rgba(0,0,0,0.05)', width: '65%' }} />
      <div className="h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.04)', width: '45%' }} />
      <div className="h-8 rounded-xl mt-2" style={{ background: 'rgba(0,0,0,0.04)', width: '40%' }} />
    </div>
  );
}

// ── Aviation hero-card skeleton ───────────────────────────────────────────────

function HeroCardSkeleton() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px 18px 18px' }}
    >
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ height: 20, width: 88, borderRadius: 999, background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ height: 20, width: 22, borderRadius: 5, background: 'rgba(0,0,0,0.04)' }} />
      </div>

      {/* Airline name + route */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, justifyContent: 'center', paddingBlock: 12 }}>
        <div style={{ height: 18, width: '58%', borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
        <div style={{ height: 11, width: '42%', borderRadius: 4, background: 'rgba(0,0,0,0.04)' }} />

        {/* Metrics pills */}
        <div style={{ display: 'flex', gap: 6, marginBlockStart: 6 }}>
          {([50, 46, 66] as number[]).map((w, i) => (
            <div key={i} style={{ height: 30, width: w, borderRadius: 8, background: 'rgba(0,0,0,0.04)' }} />
          ))}
        </div>
      </div>

      {/* Price + drag handle */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ height: 8, width: 52, borderRadius: 4, background: 'rgba(0,0,0,0.04)', marginBlockEnd: 5 }} />
          <div style={{ height: 30, width: 82, borderRadius: 6, background: 'rgba(0,0,0,0.07)' }} />
        </div>
        <div style={{ height: 30, width: 58, borderRadius: 10, background: 'rgba(0,0,0,0.05)' }} />
      </div>
    </div>
  );
}
