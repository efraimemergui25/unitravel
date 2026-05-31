'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/ui/GlassCard';
import { StreamEntity } from '@/components/DraggableEntity';
import { useTravelEngine } from '@/store/useTravelEngine';
import { AggregatedResult } from '@/services/OmniAggregator';

type FilterCategory = 'all' | 'flight' | 'hotel' | 'restaurant';

const CATEGORY_KEYS = ['all', 'flight', 'hotel', 'restaurant'] as const;
const CATEGORY_ICONS: Record<string, string> = {
  all: '✦', flight: '✈️', hotel: '🏨', restaurant: '🍽️',
};

function ProcessingHeader({ status, progress, sourcesQueried, processingMs }: {
  status: string;
  progress: { sourcesScanned: number; totalSources: number; currentSource: string; percentComplete: number } | null;
  sourcesQueried: number;
  processingMs: number | null;
}) {
  const t      = useTranslations('Omni');
  const isActive = status === 'scanning' || status === 'ranking';

  const statusText =
    status === 'idle'     ? t('idle') :
    status === 'scanning' ? t('scanning', { source: progress?.currentSource || '...' }) :
    status === 'ranking'  ? t('ranking') :
    status === 'ready' && processingMs
      ? t('ready', { sources: sourcesQueried, ms: processingMs })
      : '';

  return (
    <div className="p-4 pb-3" style={{ borderBlockEnd: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <motion.div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5E5CE6 0%, #007AFF 100%)' }}
          animate={isActive ? {
            boxShadow: ['0 0 16px rgba(94,92,230,0.5)', '0 0 32px rgba(0,122,255,0.6)', '0 0 16px rgba(94,92,230,0.5)'],
          } : { boxShadow: '0 0 20px rgba(94,92,230,0.35)' }}
          transition={{ duration: 1.8, repeat: isActive ? Infinity : 0 }}
        >
          <motion.span
            animate={isActive ? { rotate: 360 } : {}}
            transition={isActive ? { duration: 3, repeat: Infinity, ease: 'linear' } : {}}
          >
            ✦
          </motion.span>
        </motion.div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-widest" style={{
            background: 'linear-gradient(135deg, #5E5CE6, #007AFF)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {t('title')}
          </p>
          <p className="text-[10px] text-white/35 truncate">{statusText}</p>
        </div>

        <AnimatePresence mode="wait">
          {status === 'ready' && (
            <motion.div key="done"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="text-[9px] font-bold px-2 py-1 rounded-full"
              style={{ background: 'rgba(48,209,88,0.15)', color: '#30D158', border: '1px solid rgba(48,209,88,0.25)' }}
            >
              {t('statusReady')}
            </motion.div>
          )}
          {isActive && (
            <motion.div key="active"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="text-[9px] font-bold px-2 py-1 rounded-full"
              style={{ background: 'rgba(94,92,230,0.15)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.25)' }}
            >
              {t('statusLive')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #5E5CE6, #007AFF, #00C7BE)' }}
          animate={{ width: `${(progress?.percentComplete ?? (status === 'ready' ? 1 : 0)) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <AnimatePresence mode="wait">
        {isActive && progress && (
          <motion.p
            key={progress.currentSource}
            className="text-[9px] text-white/25 mt-1.5 truncate"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {t('progress', { scanned: progress.sourcesScanned, total: progress.totalSources, source: progress.currentSource })}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NeuralStream() {
  const { pipeline, runAIPipeline } = useTravelEngine();
  const [filter, setFilter] = useState<FilterCategory>('all');
  const t  = useTranslations('Omni');
  const tc = useTranslations('Category');

  useEffect(() => {
    if (pipeline.status === 'idle') runAIPipeline();
  }, []);

  const filtered: AggregatedResult[] = pipeline.suggestions.filter(s =>
    filter === 'all' || s.category === filter
  );
  const unplaced      = filtered.filter(s => !pipeline.placedIds.has(s.id));
  const placedCount   = pipeline.placedIds.size;
  const isProcessing  = pipeline.status === 'scanning' || pipeline.status === 'ranking';

  return (
    <motion.div
      layout
      className="flex flex-col h-full w-[320px] flex-shrink-0"
      style={{ borderInlineEnd: '1px solid rgba(255,255,255,0.07)' }}
    >
      <ProcessingHeader
        status={pipeline.status}
        progress={pipeline.progress}
        sourcesQueried={pipeline.sourcesQueried}
        processingMs={pipeline.processingMs}
      />

      {/* Category tabs */}
      <div className="flex items-center gap-1 p-3 pb-2"
        style={{ borderBlockEnd: '1px solid rgba(255,255,255,0.05)' }}>
        {CATEGORY_KEYS.map(key => {
          const isActive = filter === key;
          const count = key === 'all'
            ? pipeline.suggestions.length
            : pipeline.suggestions.filter(s => s.category === key).length;
          return (
            <motion.button
              key={key}
              onClick={() => setFilter(key)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-semibold"
              style={isActive
                ? { background: 'rgba(94,92,230,0.20)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.30)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }
              }
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <span className="text-xs">{CATEGORY_ICONS[key]}</span>
              {count > 0 && <span className="text-[9px] opacity-60">{count}</span>}
            </motion.button>
          );
        })}
      </div>

      <div className="px-3 py-2">
        <p className="text-[9px] text-white/25 uppercase tracking-widest">
          {t('curatedFor', { tier: 'Ultra-Luxury' })}
        </p>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {isProcessing ? (
            [0, 1, 2].map(i => (
              <motion.div key={`skeleton-${i}`}
                className="rounded-2xl h-28 shimmer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              />
            ))
          ) : unplaced.length > 0 ? (
            unplaced.map((entity, i) => (
              <StreamEntity key={entity.id} entity={entity} index={i} />
            ))
          ) : (
            <motion.div key="empty"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <span className="text-4xl">🎉</span>
              <div className="text-center">
                <p className="text-xs font-semibold text-white/60">
                  {t('allPlaced')}
                </p>
                <p className="text-[10px] text-white/30 mt-1">{t('allPlacedSub')}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-3" style={{ borderBlockStart: '1px solid rgba(255,255,255,0.07)' }}>
        <motion.button
          onClick={runAIPipeline}
          disabled={isProcessing}
          className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          style={{ background: 'rgba(94,92,230,0.12)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.25)' }}
          whileHover={{ background: 'rgba(94,92,230,0.20)', boxShadow: '0 0 20px rgba(94,92,230,0.25)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <motion.span
            animate={isProcessing ? { rotate: 360 } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            ✦
          </motion.span>
          {isProcessing ? t('rescanning') : t('rescan', { count: 90 })}
        </motion.button>
      </div>
    </motion.div>
  );
}
