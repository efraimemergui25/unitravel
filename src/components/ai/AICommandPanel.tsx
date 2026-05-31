'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GlassCard } from '@/components/ui/GlassCard';
import { CategoryIcon, getCategoryColor } from '@/components/ui/CategoryIcon';
import { BudgetBadge } from '@/components/ui/BudgetBadge';
import { useTripStore } from '@/store/tripStore';
import { TravelEntity } from '@/types';

function DraggableSuggestion({ entity }: { entity: TravelEntity }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entity.id,
    data: { entity, sourceDayId: null },
  });

  const color = getCategoryColor(entity.category);

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 9999 : 'auto',
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      layoutId={`suggestion-${entity.id}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <motion.div
        className="rounded-xl p-3 cursor-grab active:cursor-grabbing flex items-start gap-3"
        style={{
          background: isDragging ? `${color}18` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isDragging ? color + '40' : 'rgba(255,255,255,0.09)'}`,
          boxShadow: isDragging
            ? `0 24px 48px rgba(0,0,0,0.6), 0 0 24px ${color}40`
            : `0 2px 8px rgba(0,0,0,0.25)`,
        }}
        whileHover={{
          y: -2,
          background: `${color}12`,
          borderColor: `${color}30`,
          boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${color}25`,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...attributes}
        {...listeners}
      >
        <CategoryIcon category={entity.category} size="sm" pulse />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-white/90 leading-tight">{entity.title}</p>
            <BudgetBadge amount={entity.price} size="sm" />
          </div>
          <p className="text-[10px] text-white/45 truncate">{entity.subtitle}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {entity.time && (
              <span className="text-[9px] text-white/35">⏰ {entity.time}</span>
            )}
            {entity.duration && (
              <span className="text-[9px] text-white/35">⏱ {entity.duration}</span>
            )}
            {entity.rating && (
              <span className="text-[9px] font-semibold" style={{ color: '#FFD60A' }}>
                ★ {entity.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Drag handle visual */}
        <div className="flex flex-col gap-0.5 flex-shrink-0 mt-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 flex gap-0.5">
              <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

const TYPING_PLACEHOLDER_TEXTS = [
  'Find a private cenote tour near Tulum...',
  'Book a helicopter to Cabo for Day 18...',
  'Best Michelin restaurants in Mexico City...',
  'Suggest a sunrise yoga session at Rosewood...',
];

export function AICommandPanel() {
  const { aiSuggestions, aiPanelOpen, toggleAIPanel } = useTripStore();
  const [inputValue, setInputValue] = useState('');
  const [placeholderIdx] = useState(0);

  return (
    <AnimatePresence>
      {aiPanelOpen && (
        <motion.div
          key="ai-panel"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="fixed right-0 top-0 h-full w-80 flex flex-col z-30"
          style={{ paddingTop: 72, paddingBottom: 16, paddingRight: 12 }}
        >
          <GlassCard variant="deep" className="flex-1 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between p-4 pb-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #5E5CE6 0%, #007AFF 100%)', boxShadow: '0 0 16px rgba(94,92,230,0.4)' }}
                  animate={{ boxShadow: ['0 0 16px rgba(94,92,230,0.4)', '0 0 24px rgba(0,122,255,0.4)', '0 0 16px rgba(94,92,230,0.4)'] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <span className="text-sm">✦</span>
                </motion.div>
                <div>
                  <p className="text-xs font-bold text-white/90">AI Concierge</p>
                  <p className="text-[10px] text-white/35">Drag cards to your timeline</p>
                </div>
              </div>
              <button
                onClick={toggleAIPanel}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            {/* AI input */}
            <div className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <span className="text-xs text-white/30">✦</span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={TYPING_PLACEHOLDER_TEXTS[placeholderIdx]}
                  className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/25 outline-none"
                />
                {inputValue && (
                  <motion.button
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,122,255,0.2)', color: '#007AFF' }}
                  >
                    ↵
                  </motion.button>
                )}
              </div>
            </div>

            {/* Suggestions list */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">
                ✦ AI-curated for Effi & Nofar
              </p>
              <AnimatePresence mode="popLayout">
                {aiSuggestions.map(entity => (
                  <DraggableSuggestion key={entity.id} entity={entity} />
                ))}
              </AnimatePresence>
              {aiSuggestions.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 gap-2"
                >
                  <span className="text-3xl">✓</span>
                  <p className="text-xs text-white/30 text-center">All suggestions added to your timeline</p>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
