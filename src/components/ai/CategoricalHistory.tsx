'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence }        from 'framer-motion';
import { useTravelEngine }                from '@/store/useTravelEngine';
import type { ChatCategory }              from '@/store/useTravelEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 26 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<ChatCategory, { icon: string; label: string; color: string }> = {
  aviation:     { icon: '✈️', label: 'Flights',        color: '#007AFF' },
  lodging:      { icon: '🏨', label: 'Hotels',         color: '#30D158' },
  culinary:     { icon: '🍽️', label: 'Dining',         color: '#FF9F0A' },
  budget:       { icon: '💰', label: 'Budget',         color: '#FF453A' },
  destinations: { icon: '📍', label: 'Destinations',   color: '#BF5AF2' },
  activities:   { icon: '🎯', label: 'Activities',     color: '#00C7BE' },
  general:      { icon: '💬', label: 'General',        color: '#6E6E73' },
};

// ── Category folder pill ──────────────────────────────────────────────────────

function CategoryPill({
  category,
  count,
  preview,
  isActive,
  onClick,
}: {
  category:  ChatCategory;
  count:     number;
  preview:   string;
  isActive:  boolean;
  onClick:   () => void;
}) {
  const meta = CATEGORY_META[category];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      title={`${meta.label} · ${count} message${count !== 1 ? 's' : ''} · ${preview}`}
      style={{
        position:       'relative',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            3,
        paddingBlock:   8,
        paddingInline:  12,
        borderRadius:   14,
        border:         isActive
          ? `1.5px solid ${meta.color}50`
          : '1.5px solid rgba(255,255,255,0.50)',
        background:     isActive
          ? `${meta.color}12`
          : 'rgba(255,255,255,0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:      isActive
          ? `inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 10px ${meta.color}20`
          : 'inset 0 1px 0 rgba(255,255,255,0.6)',
        cursor:         'pointer',
        fontFamily:     'inherit',
        flexShrink:     0,
        minWidth:       80,
        textAlign:      'start',
        userSelect:     'none',
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="cat-active-bar"
          style={{
            position:       'absolute',
            insetBlockStart: 0,
            insetInlineStart: '20%',
            insetInlineEnd:   '20%',
            height:         2,
            borderRadius:   999,
            background:     meta.color,
            boxShadow:      `0 0 6px ${meta.color}99`,
          }}
          transition={SPRING}
        />
      )}

      {/* Icon + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>{meta.icon}</span>
        <span style={{
          fontSize:   9,
          fontWeight: 900,
          color:      'white',
          background: meta.color,
          borderRadius: 6,
          paddingBlock: 1, paddingInline: 5,
          letterSpacing: '-0.01em',
        }}>
          {count}
        </span>
      </div>

      {/* Label */}
      <span style={{
        fontSize:     10,
        fontWeight:   isActive ? 800 : 600,
        color:        isActive ? meta.color : '#6E6E73',
        letterSpacing: '-0.01em',
        whiteSpace:   'nowrap',
      }}>
        {meta.label}
      </span>

      {/* Preview snippet */}
      <span style={{
        fontSize:     9,
        fontWeight:   400,
        color:        '#8E8E93',
        whiteSpace:   'nowrap',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        maxWidth:     100,
        lineHeight:   1.3,
      }}>
        {preview}
      </span>
    </motion.button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CategoricalHistoryProps {
  activeCategory: ChatCategory | 'all';
  onSelect:       (category: ChatCategory | 'all') => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CategoricalHistory({ activeCategory, onSelect }: CategoricalHistoryProps) {
  const chatHistory  = useTravelEngine(s => s.chatHistory);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart    = useRef<{ x: number; scrollLeft: number } | null>(null);

  // Group messages by category, preserving last-message-preview
  const grouped = chatHistory.reduce<Record<ChatCategory, { count: number; lastText: string }>>(
    (acc, msg) => {
      const cat = msg.category;
      if (!acc[cat]) acc[cat] = { count: 0, lastText: '' };
      acc[cat]!.count++;
      acc[cat]!.lastText = msg.text.slice(0, 32);
      return acc;
    },
    {} as Record<ChatCategory, { count: number; lastText: string }>,
  );

  const categories = Object.entries(grouped) as [ChatCategory, { count: number; lastText: string }][];

  // Horizontal drag-scroll
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current || !scrollRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  if (categories.length === 0) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ ...SPRING, duration: 0.25 }}
      style={{
        borderBlockEnd: '1px solid rgba(255,255,255,0.40)',
        overflow:       'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        paddingBlock:   8,
        paddingInline:  12,
      }}>
        <span style={{
          fontSize: 9.5, fontWeight: 800, color: '#8E8E93',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          fontFamily: 'inherit',
        }}>
          Conversation Memory
        </span>

        {/* "All" quick reset */}
        {activeCategory !== 'all' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING_POP}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect('all')}
            style={{
              paddingBlock:  3, paddingInline: 8,
              borderRadius:  8,
              border:        '1px solid rgba(0,0,0,0.08)',
              background:    'rgba(0,0,0,0.04)',
              color:         '#6E6E73', fontSize: 9.5,
              fontWeight:    700, cursor: 'pointer',
              fontFamily:    'inherit',
            }}
          >
            Show all
          </motion.button>
        )}
      </div>

      {/* Horizontal pill strip */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          display:        'flex',
          flexDirection:  'row',
          gap:            8,
          overflowX:      'auto',
          paddingInline:  12,
          paddingBlockEnd: 10,
          cursor:         isDragging ? 'grabbing' : 'grab',
          userSelect:     'none',
          WebkitUserSelect: 'none',
        }}
      >
        <AnimatePresence>
          {categories.map(([cat, data]) => (
            <CategoryPill
              key={cat}
              category={cat}
              count={data.count}
              preview={data.lastText}
              isActive={activeCategory === cat}
              onClick={() => onSelect(activeCategory === cat ? 'all' : cat)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
