'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id:       string;
  message:  string;
  variant:  ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string) => void;
  error:   (message: string) => void;
  info:    (message: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  toast:   () => {},
  success: () => {},
  error:   () => {},
  info:    () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  bg: string; border: string; color: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}> = {
  success: { bg: 'rgba(48,209,88,0.10)',   border: 'rgba(48,209,88,0.28)',   color: '#30D158', Icon: CheckCircle2 },
  error:   { bg: 'rgba(255,69,58,0.10)',   border: 'rgba(255,69,58,0.28)',   color: '#FF453A', Icon: AlertTriangle },
  warning: { bg: 'rgba(255,159,10,0.10)',  border: 'rgba(255,159,10,0.28)',  color: '#FF9F0A', Icon: AlertTriangle },
  info:    { bg: 'rgba(0,122,255,0.09)',   border: 'rgba(0,122,255,0.25)',   color: '#007AFF', Icon: Info          },
};

// ── Single toast item ─────────────────────────────────────────────────────────

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = VARIANT_CONFIG[t.variant];
  const Icon = cfg.Icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 8,  scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        padding:        '10px 14px 10px 12px',
        borderRadius:   14,
        background:     `linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.88) 100%)`,
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        border:         `1px solid ${cfg.border}`,
        boxShadow:      `0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05), inset 0 1.5px 0 rgba(255,255,255,1)`,
        maxWidth:       340,
        minWidth:       200,
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Colored left stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: cfg.color, borderRadius: '14px 0 0 14px' }} />

      {/* Icon */}
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={13} color={cfg.color} strokeWidth={2} />
      </div>

      {/* Message */}
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.012em', lineHeight: 1.4 }}>
        {t.message}
      </span>

      {/* Dismiss */}
      <motion.button
        whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
        onClick={() => onDismiss(t.id)}
        style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <X size={9} color="#6E6E73" strokeWidth={2.5} />
      </motion.button>

      {/* Progress bar */}
      <motion.div
        style={{ position: 'absolute', bottom: 0, left: 0, height: 2, background: cfg.color, borderRadius: '0 0 14px 14px', opacity: 0.35 }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: t.duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info', duration = 3200) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, message, variant, duration }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error   = useCallback((m: string) => toast(m, 'error',   4000), [toast]);
  const info    = useCallback((m: string) => toast(m, 'info'),    [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}

      {/* Toast stack — bottom-right of the workspace pane */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: 'auto' }}>
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
