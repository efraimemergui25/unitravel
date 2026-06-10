'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, type DynamicToolUIPart } from 'ai';
import { useRouter } from 'next/navigation';
import { ArrowRight, LayoutGrid, Sparkles, Check, MapPin, Users, Wallet, Clock } from 'lucide-react';
import { useTravelEngine } from '@/store/useTravelEngine';
import { FinancialEngine } from '@/utils/FinancialEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommitTripArgs {
  destination: string;
  nights: number;
  startDate?: string;
  travelers: number;
  budget: number;
  preferences: string;
  committed?: boolean;
}

// ── Spring presets ─────────────────────────────────────────────────────────────

const SP  = { type: 'spring', stiffness: 380, damping: 28 } as const;
const SPF = { type: 'spring', stiffness: 460, damping: 22 } as const;

// ── Ambient orbs (light mode, no particles) ───────────────────────────────────

function AmbientOrbs() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {([
        { top: '-14%', insetInlineStart: '-6%',  w: '52%', h: '58%', c: 'rgba(0,122,255,0.08)',  a: 'breathe 22s ease-in-out infinite'       },
        { top: '-6%',  insetInlineEnd:  '-5%',   w: '44%', h: '48%', c: 'rgba(88,86,214,0.06)',  a: 'breathe 26s ease-in-out infinite', d: '8s' },
        { bottom: '-12%', insetInlineEnd: '6%',  w: '40%', h: '42%', c: 'rgba(90,200,250,0.05)', a: 'breathe 20s ease-in-out infinite', d: '4s' },
        { bottom: '-8%',  insetInlineStart: '4%', w: '36%', h: '36%', c: 'rgba(191,90,242,0.04)',a: 'breathe 24s ease-in-out infinite', d: '12s'},
      ] as { top?: string; bottom?: string; insetInlineStart?: string; insetInlineEnd?: string; w: string; h: string; c: string; a: string; d?: string }[]).map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: b.top, bottom: b.bottom,
          insetInlineStart: b.insetInlineStart,
          insetInlineEnd: b.insetInlineEnd,
          width: b.w, height: b.h,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${b.c} 0%, transparent 68%)`,
          animation: b.a, animationDelay: b.d ?? '0s',
        }} />
      ))}
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{
      display: 'flex', gap: 5, padding: '14px 16px',
      borderRadius: '6px 18px 18px 18px',
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
      alignSelf: 'flex-start',
    }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(0,122,255,0.50)' }}
          animate={{ y: [0, -6, 0], opacity: [0.40, 1, 0.40] }}
          transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Extract text from UIMessage parts ─────────────────────────────────────────

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('');
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === 'user';
  const text = getMessageText(msg);
  if (!text.trim()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SP}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 10 }}
    >
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,122,255,0.32)',
        }}>
          <Sparkles size={14} color="#fff" strokeWidth={2.2} />
        </div>
      )}
      <div style={{
        maxWidth: '72%', padding: isUser ? '12px 18px' : '16px 20px',
        borderRadius: isUser ? '18px 4px 18px 18px' : '4px 20px 20px 20px',
        background: isUser
          ? 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)'
          : 'rgba(255,255,255,0.97)',
        border: isUser ? 'none' : '1px solid rgba(0,0,0,0.07)',
        backdropFilter: isUser ? undefined : 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: isUser ? undefined : 'blur(40px) saturate(1.8)',
        boxShadow: isUser
          ? '0 6px 24px rgba(0,122,255,0.36)'
          : '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
        color: isUser ? '#fff' : '#1D1D1F',
        fontSize: 14.5, fontWeight: isUser ? 500 : 400,
        lineHeight: 1.60, letterSpacing: '-0.01em',
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </motion.div>
  );
}

// ── Trip ready card ────────────────────────────────────────────────────────────

function TripReadyCard({ tripData, onView }: { tripData: CommitTripArgs; onView: () => void }) {
  const STATS = [
    { icon: MapPin,  label: 'Destination', value: tripData.destination,                            color: '#007AFF' },
    { icon: Clock,   label: 'Duration',    value: `${tripData.nights} nights`,                    color: '#FF9F0A' },
    { icon: Users,   label: 'Travelers',   value: `${tripData.travelers}`,                        color: '#30D158' },
    { icon: Wallet,  label: 'Budget',      value: `$${tripData.budget.toLocaleString()}`,          color: '#BF5AF2' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPF}
      style={{
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid rgba(255,255,255,1)',
        borderRadius: 26,
        padding: '26px 24px',
        backdropFilter: 'blur(56px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(56px) saturate(1.9)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.10), 0 6px 24px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Full-spectrum top accent */}
      <div aria-hidden style={{ position: 'absolute', top: 0, insetInlineStart: 0, insetInlineEnd: 0, height: 3, background: 'linear-gradient(90deg, #007AFF, #5856D6, #BF5AF2, #FF2D55)', borderRadius: '26px 26px 0 0', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: 3, insetInlineStart: '8%', insetInlineEnd: '8%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 35%, rgba(255,255,255,1) 65%, transparent)', borderRadius: 999, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,122,255,0.35)' }}
        >
          <Sparkles size={14} color="#fff" strokeWidth={2.2} />
        </motion.div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>Your trip is ready</div>
          <div style={{ fontSize: 10.5, fontWeight: 500, color: '#6E6E73', marginTop: 1 }}>AI has planned everything based on your preferences</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 20 }}>
        {STATS.map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{
            padding: '12px 14px', borderRadius: 16,
            background: `${color}08`,
            border: `1px solid ${color}18`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Icon size={10} color={color} strokeWidth={2.2} />
              <div style={{ fontSize: 9.5, fontWeight: 700, color: color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{value}</div>
          </div>
        ))}
      </div>

      <motion.button
        onClick={onView}
        whileHover={{ scale: 1.02, y: -1, boxShadow: '0 12px 40px rgba(0,122,255,0.40), inset 0 1.5px 0 rgba(255,255,255,0.28)' }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%', padding: '15px', borderRadius: 16,
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          boxShadow: '0 6px 24px rgba(0,122,255,0.32), inset 0 1.5px 0 rgba(255,255,255,0.24)',
        }}
      >
        <Check size={16} color="#fff" strokeWidth={2.5} />
        <span style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>View my trip</span>
        <ArrowRight size={14} color="rgba(255,255,255,0.70)" strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GuidedJourney({ onSwitch }: { onSwitch: () => void }) {
  const router      = useRouter();
  const setupTrip   = useTravelEngine(s => s.setupTrip);
  const addDay      = useTravelEngine(s => s.addDay);
  const completeDNA = useTravelEngine(s => s.completeTravelDNA);

  const [tripData, setTripData] = useState<CommitTripArgs | null>(null);
  const [inputVal, setInputVal] = useState('');
  const messagesEndRef          = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: '/api/onboarding' }),
    messages:  [],
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Detect commitTrip tool result
  useEffect(() => {
    if (tripData) return;
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.toolName === 'commitTrip' && dp.state === 'output-available') {
          const result = dp.output as CommitTripArgs;
          if (result?.committed) {
            setTripData(result);
            commitToStore(result);
          }
        }
      }
    }
  }, [messages, tripData]); // eslint-disable-line

  const commitToStore = useCallback((data: CommitTripArgs) => {
    const today = new Date();
    const start = data.startDate
      ? new Date(data.startDate)
      : (() => { const d = new Date(today); d.setDate(today.getDate() + 14); return d; })();
    const nights = Math.max(1, data.nights);
    const end    = new Date(start); end.setDate(start.getDate() + nights);
    const fmt    = (d: Date) => d.toISOString().split('T')[0];

    const prefLower = data.preferences.toLowerCase();
    const dna = FinancialEngine.deriveDNAFromSelections({
      paceIndex:
        prefLower.includes('relax') || prefLower.includes('slow') ? 0.15
        : prefLower.includes('adventure') || prefLower.includes('active') ? 0.85
        : 0.5,
      diningSelections:
        data.budget >= 10000 ? ['michelin', 'fine-dining']
        : data.budget >= 4000 ? ['fine-dining', 'contemporary']
        : ['contemporary', 'local'],
      basecampSelection:
        data.budget >= 10000 ? 'ultra-luxury'
        : data.budget >= 4000 ? 'design-hotel'
        : 'boutique',
      activitySelections:
        prefLower.includes('cultur') ? ['culture']
        : prefLower.includes('adventur') ? ['adventure']
        : prefLower.includes('wellness') ? ['wellness']
        : [],
    });
    completeDNA(dna);

    setupTrip({
      title:       `Trip to ${data.destination}`,
      travelers:   Array.from({ length: data.travelers }, (_, i) => `Traveler ${i + 1}`),
      startDate:   fmt(start),
      endDate:     fmt(end),
      nights,
      totalBudget: data.budget,
    });

    for (let i = 0; i < nights; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      addDay({
        id:          `day-${i + 1}`,
        date:        fmt(d),
        dayNumber:   i + 1,
        destination: data.destination,
        entities:    [],
        budget:      Math.round(data.budget / nights),
        weather:     { temp: 22, icon: '☀️', condition: 'Sunny' },
      });
    }
  }, [completeDNA, setupTrip, addDay]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback(() => {
    const text = inputVal.trim();
    if (!text || isStreaming) return;
    setInputVal('');
    sendMessage({ role: 'user', parts: [{ type: 'text', text }] });
  }, [inputVal, isStreaming, sendMessage]);

  // Count AI messages with text for progress
  const aiTextMessages = messages.filter(m => m.role === 'assistant' && getMessageText(m).trim());
  const progress = Math.min(5, Math.max(0, aiTextMessages.length - 1));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'linear-gradient(160deg, #EDF0FF 0%, #FFFFFF 40%, #F4F0FF 68%, #EEF4FF 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
      }}
    >
      <AmbientOrbs />

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,122,255,0.32)',
          }}>
            <Sparkles size={13} color="#fff" strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1 }}>Unit AI</div>
            <div style={{ fontSize: 9.5, fontWeight: 500, color: '#8E8E93', marginTop: 1 }}>Travel Concierge</div>
          </div>
        </div>

        {/* Progress pills */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === progress ? 22 : 6,
                background: i < progress
                  ? '#30D158'
                  : i === progress
                    ? '#007AFF'
                    : 'rgba(0,0,0,0.12)',
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: 5, borderRadius: 3 }}
            />
          ))}
        </div>

        <motion.button
          onClick={onSwitch}
          whileHover={{ scale: 1.04, background: 'rgba(0,0,0,0.07)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 13px', borderRadius: 100,
            background: 'rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.10)',
            color: '#3C3C43',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            letterSpacing: '-0.01em',
          }}
        >
          <LayoutGrid size={11} color="#3C3C43" />
          Manual mode
        </motion.button>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '28px 24px 16px',
        display: 'flex', flexDirection: 'column', gap: 16,
        scrollbarWidth: 'none', position: 'relative', zIndex: 1,
        maxWidth: 720, width: '100%', marginInline: 'auto', boxSizing: 'border-box',
      }}>
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <Bubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isStreaming && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SP}
              style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,122,255,0.30)',
              }}>
                <Sparkles size={14} color="#fff" strokeWidth={2.2} />
              </div>
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {tripData && (
            <TripReadyCard
              key="trip-ready"
              tripData={tripData}
              onView={() => router.push('/zone/management')}
            />
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ───────────────────────────────────────────────── */}
      {!tripData && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...SP }}
          style={{
            position: 'relative', zIndex: 10,
            padding: '12px 24px 28px',
            background: 'linear-gradient(0deg, rgba(245,245,250,0.97) 0%, rgba(245,245,250,0.85) 70%, transparent 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            maxWidth: 720, width: '100%', marginInline: 'auto', boxSizing: 'border-box',
          }}
        >
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: 'rgba(255,255,255,0.97)',
            border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: 20,
            padding: '12px 12px 12px 18px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}>
            <textarea
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your answer…"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#1D1D1F', fontSize: 14.5, fontWeight: 400,
                fontFamily: 'inherit', letterSpacing: '-0.01em', lineHeight: 1.5,
                resize: 'none', minHeight: 22, maxHeight: 120, overflowY: 'auto',
                scrollbarWidth: 'none',
              }}
            />
            <motion.button
              onClick={handleSend}
              disabled={!inputVal.trim() || isStreaming}
              whileHover={{ scale: inputVal.trim() ? 1.08 : 1 }}
              whileTap={{ scale: inputVal.trim() ? 0.94 : 1 }}
              style={{
                width: 38, height: 38, borderRadius: 12, border: 'none',
                background: inputVal.trim() && !isStreaming
                  ? 'linear-gradient(135deg, #007AFF, #5856D6)'
                  : 'rgba(0,0,0,0.06)',
                cursor: inputVal.trim() && !isStreaming ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: inputVal.trim() && !isStreaming ? '0 4px 16px rgba(0,122,255,0.38)' : 'none',
                transition: 'background 0.18s, box-shadow 0.18s',
              }}
            >
              <ArrowRight size={16}
                color={inputVal.trim() && !isStreaming ? '#fff' : 'rgba(0,0,0,0.22)'}
                strokeWidth={2.5}
              />
            </motion.button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 9, fontSize: 10.5, color: '#AEAEB2', letterSpacing: '0.01em' }}>
            Enter to send · Shift+Enter for newline
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
