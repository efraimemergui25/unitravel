'use client';

// MorphingTransition.tsx — Layout morph engine for the cinematic entry flow.
// Pre-morph: renders `children` as a full-screen centered overlay.
// Post-morph: splits into 1/3 AI panel + 2/3 workspace with spring choreography.
// RTL-aware: AI panel slides from inline-start (LTR: left, RTL: right).

import React                                    from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { useLocaleEngine }                      from '@/store/useLocaleEngine';

const SPRING = { type: 'spring', stiffness: 340, damping: 34 } as const;

interface MorphingTransitionProps {
  morphed:   boolean;
  aiPanel:   React.ReactNode;
  workspace: React.ReactNode;
  children:  React.ReactNode;
}

export function MorphingTransition({
  morphed,
  aiPanel,
  workspace,
  children,
}: MorphingTransitionProps) {
  const { profile } = useLocaleEngine();
  const isRtl = profile.direction === 'rtl';

  return (
    <LayoutGroup id="morph-root">

      {/* ── Pre-morph: full-screen centered overlay ─── */}
      <AnimatePresence>
        {!morphed && (
          <motion.div
            key="entry-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4 } }}
            exit={{
              opacity:    0,
              scale:      0.97,
              filter:     'blur(10px)',
              transition: { duration: 0.5, ease: [0.4, 0, 1, 1] },
            }}
            style={{
              position:       'fixed',
              inset:          0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              zIndex:         30,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Post-morph: 1/3 AI panel + 2/3 workspace ─── */}
      <AnimatePresence>
        {morphed && (
          <motion.div
            key="split-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            style={{
              display:       'flex',
              flexDirection: isRtl ? 'row-reverse' : 'row',
              width:         '100%',
              height:        '100%',
              gap:           12,
              padding:       14,
            }}
          >
            {/* 1/3 — AI panel */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? 52 : -52, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ ...SPRING, delay: 0.06 }}
              style={{ width: '33.33%', flexShrink: 0, height: '100%' }}
            >
              {aiPanel}
            </motion.div>

            {/* 2/3 — Workspace */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? -56 : 56 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING, delay: 0.22 }}
              style={{ flex: 1, minWidth: 0, height: '100%' }}
            >
              {workspace}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </LayoutGroup>
  );
}
