'use client';

import { useState }                    from 'react';
import { motion, AnimatePresence }      from 'framer-motion';
import { useTravelEngine }              from '@/store/useTravelEngine';
import type { CategorizedMessage, ChatCategory } from '@/store/useTravelEngine';

// ── Category config ───────────────────────────────────────────────────────────

interface CategoryMeta {
  label:  string;
  icon:   string;
  color:  string;
}

const CATEGORY_META: Record<ChatCategory, CategoryMeta> = {
  aviation:     { label: 'Aviation Searches',   icon: '✈️',  color: '#007AFF' },
  lodging:      { label: 'Lodging Decisions',   icon: '🏨',  color: '#00C7BE' },
  culinary:     { label: 'Culinary Decisions',  icon: '🍽️', color: '#FF9F0A' },
  budget:       { label: 'Budget Adjustments',  icon: '💰',  color: '#30D158' },
  destinations: { label: 'Destinations',        icon: '📍',  color: '#5E5CE6' },
  activities:   { label: 'Activities & Experiences', icon: '🎯', color: '#FF453A' },
  general:      { label: 'General',             icon: '💬',  color: '#8E8E93' },
};

const SPRING = { type: 'spring', stiffness: 360, damping: 30 } as const;

// ── Message bubble ────────────────────────────────────────────────────────────

function HistoryBubble({ msg, color }: { msg: CategorizedMessage; color: string }) {
  const isUser  = msg.role === 'user';
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     isUser ? 'flex-end' : 'flex-start',
        gap:            2,
        paddingInline:  4,
      }}
    >
      <div
        style={{
          maxWidth:     '88%',
          padding:      '7px 11px',
          borderRadius: isUser ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
          background:   isUser ? `${color}18` : 'rgba(255,255,255,0.82)',
          border:       isUser ? `1px solid ${color}28` : '1px solid rgba(0,0,0,0.06)',
          fontSize:     11,
          lineHeight:   1.55,
          fontWeight:   500,
          color:        '#1D1D1F',
          letterSpacing: '-0.01em',
          whiteSpace:   'pre-wrap',
        }}
      >
        {msg.text.length > 160 ? msg.text.slice(0, 160) + '…' : msg.text}
      </div>
      <span style={{ fontSize: 8.5, color: '#AEAEB2', fontWeight: 600, paddingInline: 3 }}>
        {timeStr}
        {msg.toolsUsed?.length ? ` · ${msg.toolsUsed.join(', ')}` : ''}
      </span>
    </div>
  );
}

// ── Single category accordion ─────────────────────────────────────────────────

function CategoryAccordion({
  category,
  messages,
}: {
  category: ChatCategory;
  messages: CategorizedMessage[];
}) {
  const [open, setOpen] = useState(false);
  const meta            = CATEGORY_META[category];

  return (
    <div
      style={{
        borderRadius: 14,
        overflow:     'hidden',
        border:       `1px solid ${open ? meta.color + '2A' : 'rgba(0,0,0,0.06)'}`,
        background:   open ? `${meta.color}06` : 'rgba(255,255,255,0.60)',
        transition:   'background 0.2s, border-color 0.2s',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          gap:            9,
          padding:        '10px 13px',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'start',
        }}
      >
        <div
          style={{
            width:          28, height: 28,
            borderRadius:   8,
            background:     `${meta.color}14`,
            border:         `1px solid ${meta.color}22`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       14,
            flexShrink:     0,
          }}
        >
          {meta.icon}
        </div>

        <div style={{ flex: 1, textAlign: 'start' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 9.5, color: '#AEAEB2', fontWeight: 500, marginTop: 1 }}>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize:      9,
              fontWeight:    800,
              color:         meta.color,
              background:    `${meta.color}12`,
              border:        `1px solid ${meta.color}24`,
              borderRadius:  6,
              paddingBlock:  2,
              paddingInline: 6,
            }}
          >
            {messages.length}
          </span>
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={SPRING}
            style={{ fontSize: 10, color: '#AEAEB2', display: 'inline-block' }}
            aria-hidden
          >
            ›
          </motion.span>
        </div>
      </button>

      {/* Messages */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="messages"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                display:        'flex',
                flexDirection:  'column',
                gap:            8,
                padding:        '4px 10px 12px',
                maxHeight:      260,
                overflowY:      'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.08) transparent',
              }}
            >
              {messages.map(msg => (
                <HistoryBubble key={msg.id} msg={msg} color={meta.color} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ChatHistoryAccordion() {
  const chatHistory = useTravelEngine(s => s.chatHistory);

  // Group messages by category, preserving stable order
  const grouped = new Map<ChatCategory, CategorizedMessage[]>();
  for (const msg of chatHistory) {
    const bucket = grouped.get(msg.category) ?? [];
    bucket.push(msg);
    grouped.set(msg.category, bucket);
  }

  // Ordered by category priority
  const categoryOrder: ChatCategory[] = [
    'aviation', 'lodging', 'culinary', 'budget', 'destinations', 'activities', 'general',
  ];
  const activeCategories = categoryOrder.filter(c => grouped.has(c));

  if (chatHistory.length === 0) {
    return (
      <div
        style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            10,
          padding:        24,
          textAlign:      'center',
        }}
      >
        <div style={{ fontSize: 32 }} aria-hidden>🗂</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
          No history yet
        </div>
        <div style={{ fontSize: 11, color: '#AEAEB2', lineHeight: 1.5, maxWidth: 200 }}>
          Your conversations are automatically organized by topic as you plan.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex:           1,
        overflowY:      'auto',
        padding:        '12px 10px 20px',
        display:        'flex',
        flexDirection:  'column',
        gap:            8,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,0.08) transparent',
      }}
    >
      {/* Summary row */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          paddingInline: 4,
          marginBottom:  4,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {chatHistory.length} messages · {activeCategories.length} topics
        </span>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158' }}
          aria-hidden
        />
      </div>

      {activeCategories.map((category, i) => (
        <motion.div
          key={category}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: i * 0.04 }}
        >
          <CategoryAccordion
            category={category}
            messages={grouped.get(category)!}
          />
        </motion.div>
      ))}
    </div>
  );
}
