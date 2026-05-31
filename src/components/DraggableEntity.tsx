'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AggregatedFlight, AggregatedLodging, AggregatedDining, AggregatedResult } from '@/services/OmniAggregator';
import { PlacedEntity, useTravelEngine } from '@/store/useTravelEngine';
import { GlassCard } from '@/components/ui/GlassCard';

// ── Category palette ──────────────────────────────────────────────────────────
const CAT_PALETTE = {
  flight:     { color: '#007AFF', bg: 'rgba(0,122,255,0.12)',   icon: '✈️' },
  hotel:      { color: '#00C7BE', bg: 'rgba(0,199,190,0.12)',   icon: '🏨' },
  restaurant: { color: '#FFD60A', bg: 'rgba(255,214,10,0.10)',  icon: '🍽️' },
  activity:   { color: '#30D158', bg: 'rgba(48,209,88,0.12)',   icon: '🌊' },
  transport:  { color: '#5E5CE6', bg: 'rgba(94,92,230,0.12)',   icon: '🚁' },
} as const;

// ── Confidence ring ───────────────────────────────────────────────────────────
function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const r = 10, circ = 2 * Math.PI * r;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <circle cx={12} cy={12} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
      <motion.circle
        cx={12} cy={12} r={r}
        stroke={color} strokeWidth={2.5} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - value) }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '12px 12px', filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x={12} y={13} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={6} fontWeight={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(value * 100)}
      </text>
    </svg>
  );
}

function StarRating({ value }: { value: number }) {
  return <span className="text-[10px] font-semibold" style={{ color: '#FFD60A' }}>★ {value.toFixed(1)}</span>;
}

function SourceBadge({ count }: { count: number }) {
  const t = useTranslations('Common');
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: 'rgba(94,92,230,0.15)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.2)' }}>
      {t('sources', { count })}
    </span>
  );
}

// ── StreamEntity (in NeuralStream pill) ───────────────────────────────────────
export function StreamEntity({ entity, index }: { entity: AggregatedResult; index: number }) {
  const { placedIds } = useTravelEngine(s => s.pipeline);
  const isPlaced = placedIds.has(entity.id);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entity.id, data: { source: entity }, disabled: isPlaced,
  });

  const pal    = CAT_PALETTE[entity.category as keyof typeof CAT_PALETTE] || CAT_PALETTE.activity;
  const title  = entity.category === 'flight'     ? (entity as AggregatedFlight).airline
               : entity.category === 'hotel'      ? (entity as AggregatedLodging).name
               :                                    (entity as AggregatedDining).name;
  const price  = entity.category === 'flight'     ? (entity as AggregatedFlight).price
               : entity.category === 'hotel'      ? (entity as AggregatedLodging).totalPrice
               :                                    (entity as AggregatedDining).pricePerPerson * 2;
  const meta   = entity.category === 'flight'     ? (entity as AggregatedFlight).durationLabel
               : entity.category === 'hotel'      ? `${(entity as AggregatedLodging).nights} nights`
               :                                    `${(entity as AggregatedDining).uberMinutes}min`;
  const highlight = entity.category === 'flight'  ? (entity as AggregatedFlight).carbonAlternative
                  : entity.category === 'hotel'   ? (entity as AggregatedLodging).aiHighlight
                  :                                 (entity as AggregatedDining).aiHighlight;

  return (
    <AnimatePresence>
      {!isPlaced && (
        <motion.div
          key={entity.id}
          layoutId={`entity-${entity.id}`}
          ref={setNodeRef}
          style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 9999 : 'auto' }}
          initial={{ opacity: 0, x: 24, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25, delay: index * 0.05 }}
          {...attributes}
          {...listeners}
        >
          <motion.div
            className="rounded-2xl p-3 cursor-grab active:cursor-grabbing select-none"
            style={{
              background: isDragging ? pal.bg : 'rgba(255,255,255,0.05)',
              border:     `1px solid ${isDragging ? pal.color + '40' : 'rgba(255,255,255,0.09)'}`,
              boxShadow:  isDragging
                ? `0 28px 56px rgba(0,0,0,0.7), 0 0 32px ${pal.color}40`
                : `0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
              opacity: isDragging ? 0.35 : 1,
            }}
            whileHover={{
              y: -3, background: pal.bg, borderColor: pal.color + '35',
              boxShadow: `0 12px 32px rgba(0,0,0,0.5), 0 0 20px ${pal.color}20`,
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            <div className="flex items-start gap-2.5 mb-2">
              <motion.div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: pal.bg, border: `1px solid ${pal.color}25`, boxShadow: `0 0 12px ${pal.color}20` }}
                whileHover={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {pal.icon}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/90 leading-tight truncate">{title}</p>
                <p className="text-[10px] text-white/45 mt-0.5 truncate">
                  {entity.category === 'flight'
                    ? (entity as AggregatedFlight).route
                    : entity.category === 'hotel'
                      ? (entity as AggregatedLodging).location
                      : (entity as AggregatedDining).cuisine
                  }
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs font-black tabular-nums" style={{ color: pal.color }}>${price.toLocaleString()}</span>
                <SourceBadge count={entity.sourceCount} />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-white/40">{meta}</span>
              {'rating' in entity && (
                <StarRating value={(entity as AggregatedLodging | AggregatedDining).rating} />
              )}
              <div className="ms-auto"><ConfidenceRing value={entity.aiConfidence} color={pal.color} /></div>
            </div>

            {highlight && (
              <p className="text-[10px] text-white/35 leading-relaxed line-clamp-2 border-t border-white/5 pt-2">
                <span style={{ color: pal.color }}>✦ </span>{highlight}
              </p>
            )}

            <div className="flex flex-wrap gap-1 mt-2">
              {entity.tags.slice(0, 3).map(tag => tag && (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${pal.color}12`, color: pal.color, border: `1px solid ${pal.color}20` }}>
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex justify-center mt-2 gap-1">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── TimelineEntity (placed in timeline) ──────────────────────────────────────
export function TimelineEntity({ entity, dayId, index }: { entity: PlacedEntity; dayId: string; index: number }) {
  const [expanded, setExpanded]  = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { removeEntity, toggleBooked } = useTravelEngine();
  const t  = useTranslations('Entity');
  const tc = useTranslations('Common');

  const pal = CAT_PALETTE[entity.category] || CAT_PALETTE.activity;

  const agentActions = [
    t('syncCalendar'),
    t('autoBook'),
    t('draftEmail'),
    t('calcUber'),
    t('exportPdf'),
  ];

  return (
    <motion.div
      layoutId={`entity-${entity.sourceId}`}
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: -12 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: index * 0.03 }}
    >
      <GlassCard
        variant="default"
        className="overflow-visible"
        style={{
          borderInlineStart: `2px solid ${pal.color}`,  /* ← logical property, replaces borderLeft */
          boxShadow: `0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
        whileHover={{ y: -2, boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${pal.color}20` }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        <div className="flex items-start gap-3 p-3 pb-2">
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: pal.bg, border: `1px solid ${pal.color}25`, boxShadow: `0 0 12px ${pal.color}15` }}
            layoutId={`entity-icon-${entity.sourceId}`}
          >
            {pal.icon}
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="min-w-0">
                <motion.p
                  className="text-xs font-bold text-white/90 leading-tight truncate"
                  layoutId={`entity-title-${entity.sourceId}`}
                >
                  {entity.title}
                </motion.p>
                <p className="text-[10px] text-white/40 mt-0.5 truncate">{entity.subtitle}</p>
              </div>
              <span className="text-xs font-black tabular-nums flex-shrink-0" style={{ color: pal.color }}>
                ${entity.price.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              {entity.time     && <span className="text-[10px] text-white/40">⏰ {entity.time}</span>}
              {entity.duration && <span className="text-[10px] text-white/40">⏱ {entity.duration}</span>}
              {entity.rating   && <StarRating value={entity.rating} />}
              <ConfidenceRing value={entity.aiConfidence} color={pal.color} />
              <button
                onClick={() => toggleBooked(dayId, entity.id)}
                className="ms-auto text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                style={entity.booked
                  ? { background: 'rgba(48,209,88,0.15)', color: '#30D158', border: '1px solid rgba(48,209,88,0.25)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.09)' }
                }
              >
                {entity.booked ? tc('booked') : tc('confirm')}
              </button>
            </div>
          </div>
        </div>

        <button
          className="w-full flex items-center justify-center py-1.5 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          onClick={() => setExpanded(v => !v)}
        >
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="text-[10px] text-white/20"
          >▾</motion.span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 flex flex-col gap-2.5">
                {Object.entries(entity.details).length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(entity.details).map(([k, v]) => (
                      <div key={k} className="rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{k}</p>
                        <p className="text-[11px] text-white/70 font-medium">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {entity.aiHighlight && (
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    <span style={{ color: pal.color }}>✦ </span>{entity.aiHighlight}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setShowActions(v => !v)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${pal.color}18`, color: pal.color, border: `1px solid ${pal.color}28` }}
                  >
                    {t('aiActions')}
                  </button>
                  <button
                    onClick={() => removeEntity(dayId, entity.id)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,107,107,0.10)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}
                  >
                    {tc('remove')}
                  </button>
                </div>
                <AnimatePresence>
                  {showActions && (
                    <motion.div
                      key="actions"
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      className="flex flex-col gap-1.5"
                    >
                      {agentActions.map(a => (
                        <button key={a}
                          className="text-start text-[11px] text-white/55 hover:text-white/90 px-3 py-2 rounded-xl transition-all"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          {a}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

// ── DragOverlayEntity ─────────────────────────────────────────────────────────
export function DragOverlayEntity({ entity }: { entity: AggregatedResult }) {
  const pal   = CAT_PALETTE[entity.category as keyof typeof CAT_PALETTE] || CAT_PALETTE.activity;
  const title = entity.category === 'flight'     ? (entity as AggregatedFlight).airline
              : entity.category === 'hotel'      ? (entity as AggregatedLodging).name
              :                                    (entity as AggregatedDining).name;
  const price = entity.category === 'flight'     ? (entity as AggregatedFlight).price
              : entity.category === 'hotel'      ? (entity as AggregatedLodging).totalPrice
              :                                    (entity as AggregatedDining).pricePerPerson * 2;

  return (
    <motion.div
      initial={{ scale: 1 }} animate={{ scale: 1.04, rotate: 2 }}
      className="w-64 rounded-2xl p-3"
      style={{
        background: pal.bg, border: `1px solid ${pal.color}50`,
        boxShadow: `0 32px 64px rgba(0,0,0,0.75), 0 0 40px ${pal.color}40`,
        backdropFilter: 'blur(32px)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: pal.bg, boxShadow: `0 0 16px ${pal.color}30` }}>
          {pal.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white/90 truncate">{title}</p>
        </div>
        <span className="text-sm font-black tabular-nums" style={{ color: pal.color }}>
          ${price.toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
}
