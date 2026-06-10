'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, type DynamicToolUIPart } from 'ai';
import { useRouter } from 'next/navigation';
import { ArrowRight, LayoutGrid, Sparkles, Check } from 'lucide-react';
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

// ── Particles ─────────────────────────────────────────────────────────────────

function Particles() {
  const dots = useMemo(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i,
      x: (Math.sin(i * 7.3 + 1.1) * 0.5 + 0.5) * 100,
      y: (Math.cos(i * 5.7 + 2.3) * 0.5 + 0.5) * 100,
      r: (Math.sin(i * 3.1) * 0.5 + 0.5) * 2 + 0.4,
      dur: (Math.sin(i * 1.9) * 0.5 + 0.5) * 2.5 + 1.8,
      del: (Math.sin(i * 4.7) * 0.5 + 0.5) * 4,
    })), []);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {dots.map(d => (
        <motion.div
          key={d.id}
          style={{
            position: 'absolute',
            left: `${d.x}%`, top: `${d.y}%`,
            width: d.r, height: d.r, borderRadius: '50%',
            background: 'rgba(255,255,255,0.65)',
          }}
          animate={{ opacity: [0.05, 0.70, 0.05] }}
          transition={{ duration: d.dur, repeat: Infinity, delay: d.del, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '12px 14px', borderRadius: '4px 16px 16px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.11)', alignSelf: 'flex-start', backdropFilter: 'blur(12px)' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.50)' }}
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
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SP}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 10 }}
    >
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,122,255,0.42)' }}>
          <Sparkles size={13} color="#fff" strokeWidth={2.2} />
        </div>
      )}
      <div style={{
        maxWidth: '68%', padding: '13px 17px',
        borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        background: isUser
          ? 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)'
          : 'rgba(255,255,255,0.09)',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.13)',
        backdropFilter: isUser ? undefined : 'blur(16px)',
        boxShadow: isUser
          ? '0 4px 20px rgba(0,122,255,0.38)'
          : 'inset 0 1px 0 rgba(255,255,255,0.09)',
        color: 'rgba(255,255,255,0.92)',
        fontSize: 14, fontWeight: 400,
        lineHeight: 1.58, letterSpacing: '-0.01em',
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </motion.div>
  );
}

// ── Trip ready card ────────────────────────────────────────────────────────────

function TripReadyCard({ tripData, onView }: { tripData: CommitTripArgs; onView: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.90, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPF}
      style={{
        background: 'rgba(255,255,255,0.10)',
        border: '1.5px solid rgba(255,255,255,0.20)',
        borderRadius: 22,
        padding: '24px 22px',
        backdropFilter: 'blur(40px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35), inset 0 1.5px 0 rgba(255,255,255,0.22)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #007AFF, #5856D6, #BF5AF2, #FF2D55)', borderRadius: '22px 22px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Sparkles size={13} color="#fff" strokeWidth={2.2} />
        </motion.div>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em' }}>Trip ready</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Destination', value: tripData.destination },
          { label: 'Duration',    value: `${tripData.nights} nights` },
          { label: 'Travelers',   value: `${tripData.travelers} ${tripData.travelers === 1 ? 'person' : 'people'}` },
          { label: 'Budget',      value: `$${tripData.budget.toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.01em' }}>{value}</div>
          </div>
        ))}
      </div>

      <motion.button
        onClick={onView}
        whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(0,122,255,0.48)' }}
        whileTap={{ scale: 0.97 }}
        style={{
          width: '100%', padding: '14px', borderRadius: 14,
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,122,255,0.38)',
        }}
      >
        <Check size={15} color="#fff" strokeWidth={2.5} />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>View my trip →</span>
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
        background: 'linear-gradient(135deg, #080818 0%, #0C1640 45%, #080B1E 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
      }}
    >
      <Particles />

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,122,255,0.40)' }}>
            <Sparkles size={13} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.80)', letterSpacing: '-0.03em' }}>Unit AI</span>
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === progress ? 22 : 6,
                background: i < progress ? '#30D158' : i === progress ? '#007AFF' : 'rgba(255,255,255,0.14)',
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: 5, borderRadius: 3 }}
            />
          ))}
        </div>

        <motion.button
          onClick={onSwitch}
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.11)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 100,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.11)',
            color: 'rgba(255,255,255,0.50)',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <LayoutGrid size={11} />
          Manual mode
        </motion.button>
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 20px 12px',
        display: 'flex', flexDirection: 'column', gap: 14,
        scrollbarWidth: 'none', position: 'relative', zIndex: 1,
      }}>
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <Bubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isStreaming && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SP} style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #007AFF, #5856D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,122,255,0.40)' }}>
                <Sparkles size={13} color="#fff" strokeWidth={2.2} />
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

      {/* ── Input area ─────────────────────────────────────────────── */}
      {!tripData && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...SP }}
          style={{
            position: 'relative', zIndex: 10,
            padding: '12px 16px 28px',
            background: 'linear-gradient(0deg, rgba(8,8,24,0.96) 0%, rgba(8,8,24,0.75) 70%, transparent 100%)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.13)',
            borderRadius: 18,
            padding: '10px 12px 10px 16px',
            backdropFilter: 'blur(16px)',
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
              placeholder="Type your answer..."
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: 400,
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
                width: 36, height: 36, borderRadius: 11, border: 'none',
                background: inputVal.trim() && !isStreaming
                  ? 'linear-gradient(135deg, #007AFF, #5856D6)'
                  : 'rgba(255,255,255,0.07)',
                cursor: inputVal.trim() && !isStreaming ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: inputVal.trim() && !isStreaming ? '0 3px 14px rgba(0,122,255,0.40)' : 'none',
                transition: 'background 0.18s, box-shadow 0.18s',
              }}
            >
              <ArrowRight size={16} color={inputVal.trim() && !isStreaming ? '#fff' : 'rgba(255,255,255,0.22)'} strokeWidth={2.5} />
            </motion.button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10.5, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.01em' }}>
            Enter to send · Shift+Enter for newline
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
