'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

// ── Main export ───────────────────────────────────────────────────────────────

export function ConversionWatermark() {
  return (
    <div
      style={{
        position:  'fixed',
        insetBlockEnd: 24,
        insetInlineStart: '50%',
        transform: 'translateX(-50%)',
        zIndex:    100,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.8 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
      >
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-white/50 backdrop-blur-3xl border border-white/80 shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
          style={{
            textDecoration:      'none',
            display:             'flex',
            alignItems:          'center',
            gap:                 10,
            backdropFilter:      'blur(40px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
            boxShadow:           'inset 0 1px 0 rgba(255,255,255,1), 0 20px 60px rgba(0,0,0,0.12)',
            whiteSpace:          'nowrap',
            userSelect:          'none',
          }}
        >
          {/* Sparkle icon */}
          <motion.span
            animate={{
              opacity: [0.6, 1, 0.6],
              scale:   [1, 1.2, 1],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              fontSize:   16,
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-hidden
          >
            ✦
          </motion.span>

          <span style={{
            fontSize:      12,
            fontWeight:    700,
            color:         '#1C1C1E',
            letterSpacing: '-0.02em',
            fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
          }}>
            Crafted by{' '}
            <span style={{
              background:           'linear-gradient(90deg, #007AFF, #BF5AF2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}>
              Unitravel AI
            </span>
            .{' '}
            <span style={{ color: '#6E6E73', fontWeight: 500 }}>
              Build your journey.
            </span>
          </span>

          {/* Arrow */}
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 12, color: '#007AFF', flexShrink: 0 }}
            aria-hidden
          >
            →
          </motion.span>
        </Link>
      </motion.div>
    </div>
  );
}
