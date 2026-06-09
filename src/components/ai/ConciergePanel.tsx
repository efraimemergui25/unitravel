'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence }                   from 'framer-motion';
import { useChat }                                   from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, type DynamicToolUIPart } from 'ai';
import { useRouter }                                 from 'next/navigation';
import { useLocaleEngine }                           from '@/store/useLocaleEngine';
import { useTravelEngine, inferChatCategory }        from '@/store/useTravelEngine';
import { useZoneStore }                              from '@/store/useZoneStore';
import {
  getChatPlaceholder, getSuggestedPrompts,
  getAIIntroMessage, getPersonaLabel,
} from '@/utils/CulturalContextInjector';
import { ExecutionPill }        from './ExecutionPill';
import { ChatHistoryAccordion } from './ChatHistoryAccordion';
import {
  Sparkles, Send, Square, History, ChevronDown,
  GripVertical, Plus, ArrowRight,
  Plane, Hotel, UtensilsCrossed, Compass,
} from 'lucide-react';
import { LocaleToggleCompact } from '@/components/ui/LocaleToggle';
import { PriceWatchPanel }    from '@/components/PriceWatch';

// ── Map tool state ────────────────────────────────────────────────────────────

function toExecState(state: string): 'executing' | 'done' | 'error' {
  if (state === 'output-available')                              return 'done';
  if (state === 'output-error' || state === 'output-denied')    return 'error';
  return 'executing';
}

// ── Draggable entity card ─────────────────────────────────────────────────────

type SuggestedEntity = {
  title: string; subtitle: string; price: number;
  category: string; dayId: string; reason: string; sourceId?: string;
};

function DraggableEntityCard({ entity, onPlace }: { entity: SuggestedEntity; onPlace: (e: SuggestedEntity) => void }) {
  const AZURE = '#007AFF';
  return (
    <motion.div
      drag dragElastic={0.15} dragMomentum={false}
      whileDrag={{ scale: 1.03, boxShadow: '0 12px 40px rgba(0,122,255,0.18)' }}
      onDragEnd={() => onPlace(entity)}
      style={{
        padding: '10px 12px', borderRadius: 14,
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid rgba(0,122,255,0.16)',
        boxShadow: '0 3px 16px rgba(0,122,255,0.10)',
        cursor: 'grab', maxWidth: '88%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <GripVertical size={12} color="#AEAEB2" style={{ flexShrink: 0 }} />
        <div style={{
          width: 28, height: 28, borderRadius: 9,
          background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {entity.category === 'hotel'      ? <Hotel size={13} color="#5E5CE6" strokeWidth={2} />
         : entity.category === 'restaurant' ? <UtensilsCrossed size={13} color="#FF9F0A" strokeWidth={2} />
         : entity.category === 'activity'   ? <Compass size={13} color="#30D158" strokeWidth={2} />
         :                                    <Plane size={13} color={AZURE} strokeWidth={2} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entity.title}
          </div>
          <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 1 }}>{entity.subtitle}</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: AZURE, flexShrink: 0 }}>
          ${entity.price.toLocaleString()}
        </div>
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 9.5, color: '#AEAEB2', display: 'flex', alignItems: 'center', gap: 3 }}>
          <GripVertical size={8} /> Drag to plan or
        </span>
        <button
          onClick={() => onPlace(entity)}
          style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px',
            borderRadius: 7, cursor: 'pointer',
            background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)',
            color: '#007AFF', fontFamily: 'inherit',
          }}
        >
          Add to Day {entity.dayId.replace('day-', '')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ text, isUser, isHe }: { text: string; isUser: boolean; isHe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      style={{
        maxWidth:    '88%',
        padding:     '10px 14px',
        borderRadius: isUser ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
        position:    'relative',
        ...(isUser ? {
          background:  'linear-gradient(138deg, #007AFF 0%, #5E5CE6 55%, #7B78F0 100%)',
          border:      '1px solid rgba(255,255,255,0.20)',
          boxShadow:   '0 5px 20px rgba(0,122,255,0.38), 0 2px 6px rgba(0,122,255,0.20), inset 0 1.5px 0 rgba(255,255,255,0.22)',
        } : {
          background:  'linear-gradient(160deg, rgba(255,255,255,0.90) 0%, rgba(247,249,255,0.85) 100%)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          border:      '1px solid rgba(255,255,255,0.92)',
          boxShadow:   '0 3px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
        }),
        fontSize:    12.5,
        lineHeight:  1.65,
        fontWeight:  500,
        color:       isUser ? '#fff' : '#1D1D1F',
        letterSpacing: '-0.01em',
        direction:   isHe ? 'rtl' : 'ltr',
        whiteSpace:  'pre-wrap',
      }}
    >
      {/* Specular on AI bubbles */}
      {!isUser && (
        <div style={{
          position:   'absolute',
          left:       '10%',
          right:      '10%',
          top:        0,
          height:     '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.80), transparent)',
          borderRadius: '999px',
        }} />
      )}
      {text}
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInlineStart: 2 }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -5, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,122,255,0.45)' }}
        />
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

const AZURE  = '#007AFF';
const SPRING = { type: 'spring', stiffness: 280, damping: 28 } as const;

export function ConciergePanel({ fitParent = false }: { fitParent?: boolean }) {
  const router           = useRouter();
  const { profile }      = useLocaleEngine();
  const locale           = profile.locale;
  const isHe             = locale === 'he-IL';
  const [inputVal, setInputVal]           = useState('');
  const [focused, setFocused]             = useState(false);
  const [historyOpen, setHistoryOpen]     = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement>(null);
  const navigatedRef                      = useRef(new Set<string>());
  const syncedMsgIds                      = useRef(new Set<string>());
  const appliedToolCalls                  = useRef(new Set<string>());
  const addChatMessage                    = useTravelEngine(s => s.addChatMessage);
  const placeEntity                       = useTravelEngine(s => s.placeEntity);
  const calculatePredictiveBudget         = useTravelEngine(s => s.calculatePredictiveBudget);
  const patchDNA                          = useTravelEngine(s => s.patchDNA);
  const trip                              = useTravelEngine(s => s.trip);
  const budget                            = useTravelEngine(s => s.budget);
  const dnaProfile                        = useTravelEngine(s => s.dnaProfile);
  const activeDay                         = useTravelEngine(s => s.activeDay);
  const zoneSelectedIds                   = useZoneStore(s => s.selectedIds);
  const days                              = useTravelEngine(s => s.days);

  const uniqueDestinations = [...new Set(days.map(d => d.destination))].filter(Boolean);
  const tripContext = {
    tripTitle:   trip.title || 'New Trip',
    travelers:   trip.travelers,
    destination: uniqueDestinations[0] ?? '',
    startDate:   trip.startDate,
    endDate:     trip.endDate,
    budget:      { total: budget.total, spent: budget.spent, burnRate: budget.burnRate, projected: budget.projected, overBudgetBy: budget.overBudgetBy },
    dnaProfile,
    activeDay,
    locale,
    // Live engine selections from useZoneStore — concierge searches exactly these
    selectedEngines: {
      flights:     zoneSelectedIds('flights'),
      hotels:      zoneSelectedIds('lodging'),
      dining:      zoneSelectedIds('dining'),
      attractions: zoneSelectedIds('attractions'),
      transit:     zoneSelectedIds('transit'),
    },
  };

  const placeholder  = getChatPlaceholder(locale);
  const introMessage = getAIIntroMessage(locale);
  const persona      = getPersonaLabel(locale);

  // Dynamic prompts based on actual trip state
  const suggestedPrompts = useMemo(() => {
    const dest = uniqueDestinations[0] ?? trip.title;
    const totalEntities = days.reduce((s, d) => s + d.entities.length, 0);
    const bookedEntities = days.flatMap(d => d.entities).filter(e => e.booked).length;

    if (!dest) {
      return isHe
        ? ['איפה כדאי לנסוע בקיץ?', 'עזור לי לתכנן טיול', 'מה הטיסות הזולות ביותר?']
        : ['Where should I travel this summer?', 'Help me plan a trip', 'Cheapest flights this month'];
    }
    if (totalEntities === 0) {
      return isHe
        ? [`מצא טיסות ל${dest}`, `מלונות מומלצים ב${dest}`, `מה חובה לעשות ב${dest}?`]
        : [`Find flights to ${dest}`, `Best hotels in ${dest}`, `Top things to do in ${dest}`];
    }
    if (bookedEntities < totalEntities) {
      return isHe
        ? [`מה עוד חסר לי ב${dest}?`, 'אילו פריטים כדאי להזמין עכשיו?', 'האם אני בתוך התקציב?']
        : [`What am I missing in ${dest}?`, 'What should I book now?', 'Am I within budget?'];
    }
    return isHe
      ? [`מה ההמלצות האחרונות ל${dest}?`, 'כמה יצא הטיול?', 'הכן לי רשימת אריזה']
      : [`Latest tips for ${dest}`, 'How much will this trip cost?', 'Build me a packing list'];
  }, [uniqueDestinations, trip.title, days, isHe]);

  const { messages, sendMessage, status, stop } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat', body: { context: tripContext } }),
    messages: [{
      id:    'aria-intro',
      role:  'assistant' as const,
      parts: [{ type: 'text' as const, text: introMessage }],
    }] as UIMessage[],
  });

  const isGenerating = status === 'streaming' || status === 'submitted';

  // Navigate from AI tool calls
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.toolName === 'navigateWorkspace' && dp.state === 'output-available' && !navigatedRef.current.has(dp.toolCallId)) {
          navigatedRef.current.add(dp.toolCallId);
          const output = dp.output as { zoneId: string };
          setTimeout(() => router.push(`/zone/${output.zoneId}`), 400);
        }
      }
    }
  }, [messages, router]);

  // Apply AI tool results to store
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.state !== 'output-available') continue;
        if (appliedToolCalls.current.has(dp.toolCallId)) continue;
        appliedToolCalls.current.add(dp.toolCallId);
        if (dp.toolName === 'adjustFinancialModel') calculatePredictiveBudget();
        if (dp.toolName === 'adjustDNA') {
          const output = dp.output as { field: string; value: number } | undefined;
          if (output?.field && typeof output.value === 'number') patchDNA(output.field, output.value);
        }
      }
    }
  }, [messages, calculatePredictiveBudget, patchDNA]);

  const handlePlace = useCallback((entity: SuggestedEntity) => {
    const storeState = useTravelEngine.getState();
    if (!storeState.days.some(d => d.id === entity.dayId)) return;
    const syntheticSource = {
      id: entity.sourceId ?? `ai-placed-${Date.now()}`,
      category: (entity.category === 'hotel' ? 'hotel' : entity.category === 'restaurant' ? 'restaurant' : 'flight') as 'flight' | 'hotel' | 'restaurant',
      airline: entity.title, route: entity.subtitle, price: entity.price,
      departure: '10:00', arrival: '12:00', durationMin: 0, durationLabel: '',
      stops: 0, class: 'Economy' as const, aiConfidence: 0.9, tags: [],
      sourceCount: 1, sources: ['AI Concierge'], origin: '', destination: '',
      carbonKg: 0, carbonLabel: '', carbonAlternative: '',
      priceRange: [entity.price, entity.price] as [number, number],
      priceDropProbability: 0, seats: 0, refundable: false, flightNumber: '',
    };
    placeEntity(entity.dayId, syntheticSource as Parameters<typeof placeEntity>[1]);
  }, [placeEntity]);

  // Sync chat to store
  useEffect(() => {
    for (const msg of messages) {
      if (msg.id === 'aria-intro' || syncedMsgIds.current.has(msg.id)) continue;
      if (msg.role !== 'user' && msg.role !== 'assistant') continue;
      const text = msg.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join(' ').trim();
      if (!text) continue;
      const toolsUsed = msg.role === 'assistant' ? msg.parts.filter((p): p is DynamicToolUIPart => p.type === 'dynamic-tool').map(p => (p as DynamicToolUIPart).toolName) : [];
      syncedMsgIds.current.add(msg.id);
      addChatMessage({ id: msg.id, sessionId: 'session-' + Date.now().toString(36), role: msg.role as 'user' | 'assistant', text, category: inferChatCategory(text, toolsUsed), toolsUsed: toolsUsed.length ? toolsUsed : undefined });
    }
  }, [messages, addChatMessage]);

  // Auto-scroll
  useEffect(() => {
    if (!historyOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, historyOpen]);

  // Pick up AI prompt injected from other components (e.g. AI Gap Filler)
  useEffect(() => {
    const injected = sessionStorage.getItem('unitravel-ai-prompt');
    if (injected && !isGenerating) {
      sessionStorage.removeItem('unitravel-ai-prompt');
      setTimeout(() => {
        sendMessage({ text: injected });
      }, 600);
    }
  }, []); // eslint-disable-line

  const onSend = useCallback(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || isGenerating) return;
    sendMessage({ text: trimmed });
    setInputVal('');
  }, [inputVal, isGenerating, sendMessage]);

  return (
    <div
      style={{
        flex:          fitParent ? '1 1 auto' : undefined,
        width:         fitParent ? undefined : '100%',
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
        position:      'relative',
      }}
    >
      {/* ── Specular top line ─────────────────────────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.9) 60%, transparent 95%)',
        zIndex: 2,
      }} />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{
        padding:      '14px 16px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.045)',
        flexShrink:   0,
        background:   'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.10) 100%)',
        position:     'relative',
      }}>
        {/* Header ambient glow */}
        <div aria-hidden style={{
          position:   'absolute',
          top:        0,
          left:       '10%',
          right:      '10%',
          height:     '40%',
          background: 'radial-gradient(ellipse, rgba(0,122,255,0.07) 0%, transparent 70%)',
          pointerEvents:'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* AI avatar — premium orb */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* Outer pulse ring */}
              <motion.div
                style={{
                  position:    'absolute',
                  inset:       -5,
                  borderRadius: '50%',
                  border:      '1.5px solid rgba(0,122,255,0.22)',
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                animate={isGenerating ? {
                  boxShadow: [
                    '0 4px 20px rgba(0,122,255,0.38), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                    '0 6px 32px rgba(94,92,230,0.50), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                    '0 4px 20px rgba(191,90,242,0.38), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                    '0 4px 20px rgba(0,122,255,0.38), inset 0 1.5px 0 rgba(255,255,255,0.35)',
                  ],
                } : {
                  boxShadow: '0 4px 18px rgba(0,122,255,0.34), inset 0 1.5px 0 rgba(255,255,255,0.30)',
                }}
                transition={{ duration: 2.8, repeat: isGenerating ? Infinity : 0 }}
                style={{
                  width:          44,
                  height:         44,
                  borderRadius:   14,
                  background:     'linear-gradient(138deg, #007AFF 0%, #5E5CE6 52%, #BF5AF2 100%)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  border:         '1px solid rgba(255,255,255,0.28)',
                  position:       'relative',
                  overflow:       'hidden',
                }}
              >
                {/* Specular shimmer — shimmer-x translates the element left→right */}
                <div style={{
                  position:   'absolute',
                  top:        0,
                  left:       0,
                  width:      '55%',
                  height:     '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
                  animation:  'shimmer-x 3.8s ease-in-out infinite',
                  animationDelay: '1.4s',
                  pointerEvents: 'none',
                }} />
                {/* Corner refraction */}
                <div style={{
                  position:   'absolute',
                  top:        0,
                  left:       0,
                  width:      '50%',
                  height:     '50%',
                  background: 'radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />
                <Sparkles size={19} color="#fff" strokeWidth={1.8} style={{ position: 'relative', zIndex: 1 }} />
              </motion.div>

              {/* Status dot */}
              <motion.div
                style={{
                  position:   'absolute',
                  bottom:     -1,
                  right:      -1,
                  width:      11,
                  height:     11,
                  borderRadius: '50%',
                  background: isGenerating ? '#FF9F0A' : '#30D158',
                  border:     '2px solid rgba(255,255,255,0.95)',
                  boxShadow:  `0 0 8px ${isGenerating ? 'rgba(255,159,10,0.60)' : 'rgba(48,209,88,0.50)'}`,
                }}
                animate={{ scale: isGenerating ? [1, 1.25, 1] : 1 }}
                transition={{ duration: 0.8, repeat: isGenerating ? Infinity : 0 }}
              />
            </div>

            <div>
              <div style={{
                fontSize:      14,
                fontWeight:    800,
                letterSpacing: '-0.028em',
                background:    'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}>
                {persona.name}
              </div>
              <div style={{ fontSize: 10, color: '#AEAEB2', fontWeight: 500, marginTop: 1.5, letterSpacing: '-0.01em' }}>
                {persona.tagline}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* History toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
              onClick={() => setHistoryOpen(v => !v)}
              title="Chat history"
              aria-label="Chat history"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                background:    historyOpen ? 'rgba(0,122,255,0.09)' : 'rgba(0,0,0,0.04)',
                border:        historyOpen ? '1px solid rgba(0,122,255,0.22)' : '1px solid rgba(0,0,0,0.07)',
                color:         historyOpen ? AZURE : '#6E6E73',
                fontSize:      10, fontWeight: 700, letterSpacing: '-0.01em',
                fontFamily:    'inherit', transition: 'all 0.18s ease',
              }}
            >
              <History size={11} strokeWidth={2} />
              History
            </motion.button>

            {/* Locale toggle */}
            <LocaleToggleCompact />

            {/* Live status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div className="pulse-dot" />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158', letterSpacing: '-0.01em' }}>Live</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── History accordion ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {historyOpen && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <ChatHistoryAccordion />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Price Watch panel ─────────────────────────────────────── */}
      {!historyOpen && (
        <div style={{
          borderRadius: 12, margin: '0 8px 4px',
          background: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <PriceWatchPanel />
        </div>
      )}

      {/* ── Message thread ─────────────────────────────────────────── */}
      <div
        className="scroll-fade"
        style={{
          flex:       historyOpen ? 0 : 1,
          display:    historyOpen ? 'none' : 'flex',
          flexDirection: 'column',
          overflowY:  'auto',
          padding:    '12px 14px',
          gap:        10,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.08) transparent',
        }}
      >
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              gap: 5,
            }}>
              {msg.parts.map((part, pi) => {
                if (part.type === 'text') {
                  return <MessageBubble key={pi} text={part.text} isUser={isUser} isHe={isHe} />;
                }
                if (part.type === 'dynamic-tool') {
                  const dp    = part as DynamicToolUIPart;
                  const state = toExecState(dp.state);
                  if (dp.toolName === 'mutateTimeline' && state === 'done') {
                    const res = dp.output as { requiresConfirmation: boolean; entity: SuggestedEntity } | undefined;
                    if (res?.requiresConfirmation && res.entity) {
                      return (
                        <div key={dp.toolCallId} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <ExecutionPill toolName={dp.toolName} args={(dp.input ?? {}) as Record<string, unknown>} state={state} result={dp.output} />
                          <DraggableEntityCard entity={res.entity} onPlace={handlePlace} />
                        </div>
                      );
                    }
                  }
                  return (
                    <ExecutionPill
                      key={dp.toolCallId}
                      toolName={dp.toolName}
                      args={(dp.input ?? {}) as Record<string, unknown>}
                      state={state}
                      result={state === 'done' ? dp.output : undefined}
                    />
                  );
                }
                return null;
              })}
            </div>
          );
        })}

        <AnimatePresence>
          {isGenerating && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px 18px', borderTop: '1px solid rgba(0,0,0,0.04)', flexShrink: 0 }}>
        <motion.div
          animate={{
            boxShadow: focused
              ? `0 0 0 2.5px rgba(0,122,255,0.16), 0 4px 20px rgba(0,122,255,0.10)`
              : '0 2px 8px rgba(0,0,0,0.04)',
            borderColor: focused ? 'rgba(0,122,255,0.22)' : 'rgba(0,0,0,0.08)',
          }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(248,248,252,0.92)',
            border: '1.5px solid rgba(0,0,0,0.08)',
            borderRadius: 16, padding: '10px 12px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            placeholder={placeholder}
            disabled={isGenerating}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12.5, fontWeight: 500, color: '#1D1D1F',
              letterSpacing: '-0.01em', direction: isHe ? 'rtl' : 'ltr',
              fontFamily: 'inherit',
            }}
          />

          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.button
                key="stop"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={stop}
                title="Stop generating"
                aria-label="Stop generating"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,59,48,0.09)', border: '1.5px solid rgba(255,59,48,0.22)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FF3B30', flexShrink: 0,
                }}
              >
                <Square size={10} strokeWidth={2.5} fill="#FF3B30" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                onClick={onSend}
                aria-label="Send message"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: inputVal.trim() ? 'linear-gradient(135deg, #007AFF, #5E5CE6)' : 'rgba(0,0,0,0.07)',
                  border: 'none', cursor: inputVal.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.2s ease',
                  boxShadow: inputVal.trim() ? '0 3px 10px rgba(0,122,255,0.30)' : 'none',
                }}
              >
                <ArrowRight size={12} color={inputVal.trim() ? '#fff' : '#AEAEB2'} strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Suggested prompts */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          {suggestedPrompts.map(prompt => (
            <motion.button
              key={prompt}
              whileHover={{ scale: 1.03, background: 'rgba(0,122,255,0.12)', borderColor: 'rgba(0,122,255,0.26)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setInputVal(prompt);
                setTimeout(() => {
                  if (!isGenerating) sendMessage({ text: prompt });
                  setInputVal('');
                }, 10);
              }}
              style={{
                fontSize: 10.5, fontWeight: 600, color: AZURE,
                background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.18)',
                borderRadius: 100, padding: '5px 12px',
                cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                fontFamily: 'inherit', letterSpacing: '-0.012em',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <ArrowRight size={9} color={AZURE} strokeWidth={2.5} />
              {prompt}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
