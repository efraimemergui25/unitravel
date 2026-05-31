'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence }                   from 'framer-motion';
import { useChat }                                   from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, type DynamicToolUIPart } from 'ai';
import { useRouter }                                 from 'next/navigation';
import { useLocaleEngine }                           from '@/store/useLocaleEngine';
import { useTravelEngine, inferChatCategory }        from '@/store/useTravelEngine';
import {
  getChatPlaceholder, getSuggestedPrompts,
  getAIIntroMessage, getPersonaLabel,
} from '@/utils/CulturalContextInjector';
import { ExecutionPill }        from './ExecutionPill';
import { ChatHistoryAccordion } from './ChatHistoryAccordion';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE  = '#007AFF';
const SPRING = { type: 'spring', stiffness: 280, damping: 28 } as const;

const TRIP_CONTEXT = {
  tripTitle:   'Mexico 2026',
  travelers:   ['Effi', 'Nofar'],
  destination: 'Mexico City',
  startDate:   'Oct 1, 2026',
  endDate:     'Oct 14, 2026',
  budget:      { total: 14000, spent: 4200, burnRate: 0.30, projected: 11200 },
  dnaProfile:  null,
  activeDay:   null,
} as const;

// ── Map DynamicToolUIPart state → ExecutionPill ExecState ─────────────────────

function toExecState(state: string): 'executing' | 'done' | 'error' {
  if (state === 'output-available')                return 'done';
  if (state === 'output-error' || state === 'output-denied') return 'error';
  return 'executing';
}

// ── DraggableEntityCard ───────────────────────────────────────────────────────

function DraggableEntityCard({
  entity,
}: {
  entity: {
    title: string; subtitle: string; price: number;
    category: string; dayId: string; reason: string;
  };
}) {
  return (
    <motion.div
      drag
      dragElastic={0.18}
      dragMomentum={false}
      whileDrag={{ scale: 1.04, boxShadow: '0 12px 40px rgba(0,122,255,0.22)' }}
      onDragEnd={() =>
        document.dispatchEvent(new CustomEvent('unitravel:zone-drag-commit', {
          detail: {
            type: 'flight', title: entity.title, subtitle: entity.subtitle,
            price: entity.price, currency: 'USD', sourceZone: entity.category,
          },
        }))
      }
      style={{
        padding: '10px 13px', borderRadius: 14,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(0,122,255,0.18)',
        boxShadow: '0 3px 16px rgba(0,122,255,0.12)',
        cursor: 'grab', maxWidth: '86%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0,
        }}>
          {entity.category === 'hotel' ? '🏨' : entity.category === 'restaurant' ? '🍽' : '✈️'}
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {entity.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{entity.subtitle}</div>
        </div>
        <div style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 800, color: AZURE, flexShrink: 0 }}>
          ${entity.price.toLocaleString()}
        </div>
      </div>
      <div style={{
        marginTop: 7, fontSize: 9.5, color: 'var(--text-tertiary)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ opacity: 0.6 }}>⠿</span>
        <span>Drag to timeline</span>
      </div>
    </motion.div>
  );
}

// ── Text bubble ───────────────────────────────────────────────────────────────

function TextBubble({
  text, isUser, isHe,
}: { text: string; isUser: boolean; isHe: boolean }) {
  return (
    <div style={{
      maxWidth: '86%', padding: '9px 13px',
      borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
      background:   isUser ? 'rgba(0,122,255,0.92)' : 'rgba(255,255,255,0.90)',
      border:       isUser ? 'none' : '1px solid rgba(0,0,0,0.06)',
      boxShadow:    isUser ? '0 3px 12px rgba(0,122,255,0.28)' : 'var(--shadow-sm)',
      fontSize: 12.5, lineHeight: 1.6, fontWeight: 500,
      color: isUser ? '#fff' : 'var(--text-primary)',
      letterSpacing: '-0.01em', direction: isHe ? 'rtl' : 'ltr', whiteSpace: 'pre-wrap',
    }}>
      {text}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ConciergePanel() {
  const router               = useRouter();
  const { profile }             = useLocaleEngine();
  const locale                  = profile.locale;
  const isHe                    = locale === 'he-IL';
  const [inputVal, setInputVal] = useState('');
  const [focused, setFocused]   = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef          = useRef<HTMLDivElement>(null);
  const navigatedRef            = useRef(new Set<string>());
  const syncedMsgIds            = useRef(new Set<string>());
  const addChatMessage          = useTravelEngine(s => s.addChatMessage);

  const placeholder      = getChatPlaceholder(locale);
  const suggestedPrompts = getSuggestedPrompts(locale);
  const introMessage     = getAIIntroMessage(locale);
  const persona          = getPersonaLabel(locale);

  const { messages, sendMessage, status, stop } = useChat<UIMessage>({
    transport: new DefaultChatTransport({
      api:  '/api/chat',
      body: { context: TRIP_CONTEXT },
    }),
    messages: [{
      id:    'aria-intro',
      role:  'assistant' as const,
      parts: [{ type: 'text' as const, text: introMessage }],
    }] as UIMessage[],
  });

  const isGenerating = status === 'streaming' || status === 'submitted';

  // Detect navigateWorkspace results and trigger routing
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (
          dp.toolName === 'navigateWorkspace' &&
          dp.state   === 'output-available' &&
          !navigatedRef.current.has(dp.toolCallId)
        ) {
          navigatedRef.current.add(dp.toolCallId);
          const output = dp.output as { zoneId: string };
          setTimeout(() => router.push(`/zone/${output.zoneId}`), 400);
        }
      }
    }
  }, [messages, router]);

  // Sync new messages to categorical chat memory in Zustand
  useEffect(() => {
    for (const msg of messages) {
      if (msg.id === 'aria-intro' || syncedMsgIds.current.has(msg.id)) continue;
      if (msg.role !== 'user' && msg.role !== 'assistant') continue;

      // Extract text from parts
      const text = msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join(' ')
        .trim();
      if (!text) continue;

      // Collect tool names used in assistant messages
      const toolsUsed = msg.role === 'assistant'
        ? msg.parts
            .filter((p): p is DynamicToolUIPart => p.type === 'dynamic-tool')
            .map(p => (p as DynamicToolUIPart).toolName)
        : [];

      syncedMsgIds.current.add(msg.id);
      addChatMessage({
        id:        msg.id,
        sessionId: 'session-' + Date.now().toString(36),
        role:      msg.role as 'user' | 'assistant',
        text,
        category:  inferChatCategory(text, toolsUsed),
        toolsUsed: toolsUsed.length ? toolsUsed : undefined,
      });
    }
  }, [messages, addChatMessage]);

  // Auto-scroll on new content
  useEffect(() => {
    if (!historyOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, historyOpen]);

  const onSend = useCallback(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || isGenerating) return;
    sendMessage({ text: trimmed });
    setInputVal('');
  }, [inputVal, isGenerating, sendMessage]);

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ ...SPRING, delay: 0.15 }}
      style={{
        flex:                 '0 0 clamp(280px, 32%, 400px)',
        display:              'flex',
        flexDirection:        'column',
        height:               '100dvh',
        background:           'rgba(255,255,255,0.78)',
        backdropFilter:       'blur(48px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
        borderInlineStart:    '1px solid rgba(0,0,0,0.06)',
        boxShadow:            'inset 1px 0 0 rgba(255,255,255,1)',
        position:             'relative',
        overflow:             'hidden',
      }}
    >
      {/* Specular top highlight */}
      <div aria-hidden style={{
        position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 0,
        height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
        zIndex: 1,
      }} />

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: `linear-gradient(135deg, ${AZURE}, #5E5CE6)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, boxShadow: `0 4px 14px rgba(0,122,255,0.30)`, flexShrink: 0,
            }}>
              ✦
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {persona.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {persona.tagline}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {/* History tab toggle */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setHistoryOpen(v => !v)}
              style={{
                fontSize:      9, fontWeight: 700,
                paddingBlock:  4, paddingInline: 9,
                borderRadius:  8, cursor: 'pointer',
                background:    historyOpen ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.04)',
                border:        historyOpen ? '1px solid rgba(0,122,255,0.22)' : '1px solid rgba(0,0,0,0.07)',
                color:         historyOpen ? AZURE : 'var(--text-secondary)',
                transition:    'all 0.18s ease',
              }}
            >
              🗂 History
            </motion.button>

            <div className="pulse-dot" />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158' }}>Live</span>
          </div>
        </div>
        {!historyOpen && (
          <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
            {['30 engines', '5 zones', 'Real-time'].map(chip => (
              <div key={chip} style={{
                fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)',
                background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 6, paddingBlock: 3, paddingInline: 7,
              }}>
                {chip}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── History accordion (replaces thread when open) ───── */}
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

      {/* ── Message thread ──────────────────────────────────── */}
      <div style={{
        flex: historyOpen ? 0 : 1,
        display: historyOpen ? 'none' : 'flex',
        overflowY: 'auto', padding: '14px 14px',
        flexDirection: 'column', gap: 10,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.10) transparent',
      }}>
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start', gap: 5,
            }}>
              {msg.parts.map((part, pi) => {
                // ── Text bubble ──────────────────────────────
                if (part.type === 'text') {
                  return (
                    <TextBubble key={pi} text={part.text} isUser={isUser} isHe={isHe} />
                  );
                }

                // ── Tool invocation ──────────────────────────
                if (part.type === 'dynamic-tool') {
                  const dp    = part as DynamicToolUIPart;
                  const state = toExecState(dp.state);

                  // mutateTimeline confirmed → draggable card
                  if (dp.toolName === 'mutateTimeline' && state === 'done') {
                    const res = dp.output as {
                      requiresConfirmation: boolean;
                      entity: Parameters<typeof DraggableEntityCard>[0]['entity'];
                    } | undefined;
                    if (res?.requiresConfirmation && res.entity) {
                      return (
                        <div key={dp.toolCallId} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <ExecutionPill
                            toolName={dp.toolName}
                            args={(dp.input ?? {}) as Record<string, unknown>}
                            state={state}
                            result={dp.output}
                          />
                          <DraggableEntityCard entity={res.entity} />
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

        {/* Typing indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInlineStart: 4 }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.72, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,122,255,0.40)' }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────── */}
      <div style={{ padding: '12px 14px 20px', borderTop: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <motion.div
          animate={{
            boxShadow: focused
              ? `0 0 0 2.5px rgba(0,122,255,0.18), var(--shadow-md)`
              : 'var(--shadow-sm)',
          }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,245,247,0.90)',
            border: `1.5px solid ${focused ? 'rgba(0,122,255,0.25)' : 'rgba(0,0,0,0.07)'}`,
            borderRadius: 14, paddingBlock: 11, paddingInline: 13,
            transition: 'border-color 0.2s ease',
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
              fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
              letterSpacing: '-0.01em', direction: isHe ? 'rtl' : 'ltr',
            }}
          />

          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.button
                key="stop"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                whileTap={{ scale: 0.9 }}
                onClick={stop}
                title="Stop generating"
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,59,48,0.10)', border: '1.5px solid rgba(255,59,48,0.25)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: '#FF3B30', flexShrink: 0, fontWeight: 900,
                }}
              >
                ■
              </motion.button>
            ) : (
              <motion.button
                key="send"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={onSend}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: inputVal.trim() ? AZURE : 'rgba(0,0,0,0.08)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: inputVal.trim() ? '#fff' : 'var(--text-tertiary)',
                  flexShrink: 0, transition: 'background 0.2s ease, color 0.2s ease',
                  boxShadow: inputVal.trim() ? '0 3px 10px rgba(0,122,255,0.30)' : 'none',
                }}
              >
                ↑
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Suggested prompts */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          {suggestedPrompts.map(prompt => (
            <button
              key={prompt}
              onClick={() => setInputVal(prompt)}
              style={{
                fontSize: 9, fontWeight: 600, color: AZURE,
                background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.14)',
                borderRadius: 7, paddingBlock: 3, paddingInline: 7,
                cursor: 'pointer', transition: 'background 0.15s ease',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
