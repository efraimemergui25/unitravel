'use client';

import { useEffect, useCallback }  from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { create }                  from 'zustand';

// ── Toast store (module-level Zustand, lightweight) ───────────────────────────

interface ToastItem {
  id:      string;
  message: string;
  onUndo?: () => void;
}

interface DynamicIslandStore {
  toast:   ToastItem | null;
  show:    (message: string, onUndo?: () => void) => void;
  dismiss: () => void;
}

export const useDynamicIslandStore = create<DynamicIslandStore>((set) => ({
  toast:   null,

  show: (message, onUndo) =>
    set({ toast: { id: `toast-${Date.now()}`, message, onUndo } }),

  dismiss: () =>
    set({ toast: null }),
}));

// ── Convenience hook ──────────────────────────────────────────────────────────

export function useDynamicIsland() {
  const { show, dismiss } = useDynamicIslandStore();
  return { show, dismiss };
}

// ── Animation constants ───────────────────────────────────────────────────────

const SPRING_ISLAND = { type: 'spring', stiffness: 520, damping: 30 } as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function DynamicIslandToast() {
  const { toast, dismiss } = useDynamicIslandStore();

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 6_000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  const handleUndo = useCallback(() => {
    toast?.onUndo?.();
    dismiss();
  }, [toast, dismiss]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -72, scale: 0.88 }}
          animate={{ opacity: 1, y: 12,  scale: 1 }}
          exit={{    opacity: 0, y: -72, scale: 0.88 }}
          transition={SPRING_ISLAND}
          style={{
            position:             'fixed',
            insetBlockStart:      0,
            insetInlineStart:     '50%',
            transform:            'translateX(-50%)',
            zIndex:               9999,
            display:              'flex',
            alignItems:           'center',
            gap:                  16,
            paddingBlock:         12,
            paddingInline:        22,
            borderRadius:         999,
            // Dark glass — only element that uses dark to grab immediate attention
            background:           'rgba(18,18,20,0.82)',
            backdropFilter:       'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            border:               '1px solid rgba(255,255,255,0.14)',
            boxShadow:            '0 8px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
            maxWidth:             480,
            pointerEvents:        'auto',
          }}
        >
          {/* AI indicator dot */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{
              width:        7,
              height:       7,
              borderRadius: '50%',
              background:   'linear-gradient(135deg, #BF5AF2, #5E5CE6)',
              boxShadow:    '0 0 6px rgba(191,90,242,0.9)',
              flexShrink:   0,
            }}
          />

          {/* Message */}
          <span style={{
            fontSize:      13,
            fontWeight:    600,
            color:         'rgba(255,255,255,0.92)',
            letterSpacing: '-0.01em',
            fontFamily:    'inherit',
            lineHeight:    1.4,
          }}>
            {toast.message}
          </span>

          {/* Undo button */}
          {toast.onUndo && (
            <motion.button
              onClick={handleUndo}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              style={{
                paddingBlock:         6,
                paddingInline:        14,
                borderRadius:         999,
                background:           'rgba(255,255,255,0.12)',
                border:               '1px solid rgba(255,255,255,0.22)',
                color:                'rgba(255,255,255,0.88)',
                fontSize:             11,
                fontWeight:           700,
                fontFamily:           'inherit',
                letterSpacing:        '-0.01em',
                cursor:               'pointer',
                flexShrink:           0,
                backdropFilter:       'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              Undo
            </motion.button>
          )}

          {/* Dismiss × */}
          <motion.button
            onClick={dismiss}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            style={{
              width:        22,
              height:       22,
              borderRadius: '50%',
              background:   'rgba(255,255,255,0.10)',
              border:       'none',
              color:        'rgba(255,255,255,0.45)',
              fontSize:     11,
              fontWeight:   700,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              cursor:       'pointer',
              fontFamily:   'inherit',
              flexShrink:   0,
            }}
          >
            ✕
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
