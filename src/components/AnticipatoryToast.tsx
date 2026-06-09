'use client';
import { useState, useEffect, useCallback }           from 'react';
import { motion, AnimatePresence }                     from 'framer-motion';
import { Info, Zap, AlertTriangle, AlertOctagon }      from 'lucide-react';
import { useTranslations }                             from 'next-intl';
import { useTravelEngine }                             from '@/store/useTravelEngine';
import { useToastStore }                               from '@/store/useToastStore';
import { useLocaleStore }                              from '@/store/useLocaleStore';
import type { CrisisEvent, CrisisSeverity }            from '@/services/CrisisManager';

const SEVERITY_COLOR: Record<CrisisSeverity, string> = {
  low:      '#30D158',
  medium:   '#FFD60A',
  high:     '#FF9500',
  critical: '#FF6B6B',
};

type SeverityIconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const SEVERITY_ICON: Record<CrisisSeverity, SeverityIconComp> = {
  low:      Info,
  medium:   Zap,
  high:     AlertTriangle,
  critical: AlertOctagon,
};

function AnticipatoryToastItem({ event, onDismiss }: {
  event:     CrisisEvent;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { revertCrisis }        = useTravelEngine();
  const locale                  = useLocaleStore(s => s.locale);
  const t                       = useTranslations('Crisis');

  useEffect(() => {
    const expand  = setTimeout(() => setExpanded(true), 400);
    const dismiss = setTimeout(() => onDismiss(event.id), 9_000);
    return () => { clearTimeout(expand); clearTimeout(dismiss); };
  }, [event.id, onDismiss]);

  const color = SEVERITY_COLOR[event.severity];

  const handleUndo = useCallback(() => {
    navigator.vibrate?.(50);
    revertCrisis(event.id);
    onDismiss(event.id);
  }, [event.id, revertCrisis, onDismiss]);

  void locale;

  return (
    <motion.div
      layout
      initial={{ y: -72, opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
      animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{   y: -72, opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{
        backdropFilter:       'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        background:           'rgba(12,16,28,0.92)',
        borderRadius:         expanded ? 20 : 999,
        border:               `1px solid ${color}30`,
        overflow:             'hidden',
        position:             'relative',
        boxShadow:            `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${color}15`,
      }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ borderRadius: 'inherit' }}
        animate={{
          boxShadow: [
            `inset 0 0 0 1px ${color}15`,
            `inset 0 0 0 1px ${color}45`,
            `inset 0 0 0 1px ${color}15`,
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        layout="position"
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ minWidth: expanded ? 320 : 0 }}
      >
        <motion.span layout="position" className="flex-shrink-0" style={{ filter: `drop-shadow(0 0 6px ${color})`, display: 'flex', alignItems: 'center' }}>
          {(() => { const SI = SEVERITY_ICON[event.severity]; return <SI size={16} color={color} strokeWidth={2} />; })()}
        </motion.span>
        <motion.span layout="position" className="text-sm font-bold text-white/92 whitespace-nowrap flex-1 truncate">
          {event.title}
        </motion.span>
        {!expanded && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-white/28 flex-shrink-0"
            style={{ marginInlineStart: 8 }}
          >
            {t('tapToExpand')}
          </motion.span>
        )}
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { opacity: { delay: 0.18, duration: 0.25 }, height: { type: 'spring', stiffness: 300, damping: 28 } } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
            style={{ paddingInlineStart: 16, paddingInlineEnd: 16, paddingBottom: 16 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color }}>
                {t('resolved')}
              </span>
              <div className="flex-1 h-[1px]" style={{ background: `${color}20` }} />
            </div>

            <p className="text-xs text-white/58 leading-relaxed">{event.resolution}</p>

            {event.mutations.filter(m => m.field === 'time').slice(0, 3).length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {event.mutations.filter(m => m.field === 'time').slice(0, 3).map(mut => (
                  <div key={mut.id} className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono text-white/30">{mut.oldValue}</span>
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                      style={{ color, overflow: 'hidden', flexShrink: 0 }}
                    >→</motion.span>
                    <span className="font-mono font-bold" style={{ color }}>{mut.newValue}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color, transformOrigin: 'start' }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 7.5, ease: 'linear' }}
              />
            </div>

            {event.canUndo && !event.undone && (
              <motion.button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold tracking-wide"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border:     '1px solid rgba(255,255,255,0.10)',
                  color:      'rgba(255,255,255,0.75)',
                }}
                whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.09)' }}
                whileTap={{   scale: 0.96, background: 'rgba(255,107,107,0.14)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={handleUndo}
              >
                <span>↩</span>
                <span>{t('undoAction')}</span>
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AnticipatoryToastStack() {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div
      className="fixed inset-x-0 top-5 z-[200] flex flex-col items-center gap-3 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto w-full max-w-sm" style={{ paddingInlineStart: 16, paddingInlineEnd: 16 }}>
            <AnticipatoryToastItem event={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
