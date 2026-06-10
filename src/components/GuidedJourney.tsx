'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage, type DynamicToolUIPart } from 'ai';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, LayoutGrid, Sparkles, Check,
  MapPin, Users, Wallet, Clock, Mic, MicOff, RefreshCw,
} from 'lucide-react';
import { useTravelEngine } from '@/store/useTravelEngine';
import { FinancialEngine } from '@/utils/FinancialEngine';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CONVO_LS_KEY = 'unitravel:guided-journey:v3';
const SP  = { type: 'spring', stiffness: 380, damping: 28 } as const;
const SPF = { type: 'spring', stiffness: 460, damping: 22 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface CommitTripArgs {
  destination: string;
  nights: number;
  startDate?: string;
  travelers: number;
  budget: number;
  preferences: string;
  committed?: boolean;
}

interface CollectedFields {
  destination?: string;
  dates?: string;
  travelers?: string;
  budget?: string;
  style?: string;
}

type QuickReplyContext = 'destination' | 'dates' | 'travelers' | 'budget' | 'style' | null;

interface BudgetSignal {
  level: 'green' | 'yellow' | 'red';
  msg: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN #1 — DESTINATION ATMOSPHERE THEMES
// ─────────────────────────────────────────────────────────────────────────────

const DEST_THEMES: Record<string, { gradient: string; accent: string; keywords: string[] }> = {
  paris:        { gradient: 'linear-gradient(160deg, #FFF7EC 0%, #FFFFFF 32%, #FFF3EE 58%, #FFEFF5 100%)', accent: '#FF9F0A', keywords: ['paris', 'france'] },
  tokyo:        { gradient: 'linear-gradient(160deg, #F8EEFF 0%, #FFFFFF 32%, #FFE8F5 58%, #F5DEFF 100%)', accent: '#FF2D55', keywords: ['tokyo', 'japan'] },
  dubai:        { gradient: 'linear-gradient(160deg, #FFF8E0 0%, #FFFFFF 32%, #FFFCF0 58%, #FFF8E8 100%)', accent: '#FF9F0A', keywords: ['dubai', 'uae', 'emirates'] },
  new_york:     { gradient: 'linear-gradient(160deg, #EBF2FF 0%, #FFFFFF 32%, #ECF3FF 58%, #E8EEFF 100%)', accent: '#007AFF', keywords: ['new york', 'nyc', 'manhattan'] },
  barcelona:    { gradient: 'linear-gradient(160deg, #FFF0EC 0%, #FFFFFF 32%, #FFF5EC 58%, #FFEDE8 100%)', accent: '#FF453A', keywords: ['barcelona', 'spain'] },
  rome:         { gradient: 'linear-gradient(160deg, #FFF5E8 0%, #FFFFFF 32%, #FFF9F0 58%, #FFF4E4 100%)', accent: '#FF9F0A', keywords: ['rome', 'roma', 'italy'] },
  london:       { gradient: 'linear-gradient(160deg, #EEF0F8 0%, #FFFFFF 32%, #EFF2F8 58%, #ECEFF8 100%)', accent: '#5E5CE6', keywords: ['london', 'england', 'uk'] },
  bangkok:      { gradient: 'linear-gradient(160deg, #EAFFF2 0%, #FFFFFF 32%, #EDFFF7 58%, #E8FFEE 100%)', accent: '#30D158', keywords: ['bangkok', 'thailand'] },
  bali:         { gradient: 'linear-gradient(160deg, #EDFFF5 0%, #FFFFFF 32%, #F0FFFA 58%, #E8FFF5 100%)', accent: '#00C7BE', keywords: ['bali', 'indonesia'] },
  amsterdam:    { gradient: 'linear-gradient(160deg, #EFF5FF 0%, #FFFFFF 32%, #F0F8FF 58%, #EAEFFF 100%)', accent: '#5E5CE6', keywords: ['amsterdam', 'netherlands', 'holland'] },
  madrid:       { gradient: 'linear-gradient(160deg, #FFF0EC 0%, #FFFFFF 32%, #FFF5EC 58%, #FFECEC 100%)', accent: '#FF453A', keywords: ['madrid'] },
  lisbon:       { gradient: 'linear-gradient(160deg, #FFF5F0 0%, #FFFFFF 32%, #FFFAF5 58%, #FFF5EE 100%)', accent: '#FF9F0A', keywords: ['lisbon', 'portugal'] },
  maldives:     { gradient: 'linear-gradient(160deg, #E8FAFF 0%, #FFFFFF 32%, #EDFEFF 58%, #E0F8FF 100%)', accent: '#00C7BE', keywords: ['maldives'] },
  santorini:    { gradient: 'linear-gradient(160deg, #EEF5FF 0%, #FFFFFF 32%, #E8F0FF 58%, #E0ECFF 100%)', accent: '#007AFF', keywords: ['santorini', 'mykonos', 'greece'] },
  iceland:      { gradient: 'linear-gradient(160deg, #E8F8FF 0%, #FFFFFF 32%, #ECF8FF 58%, #E4F4FF 100%)', accent: '#5AC8FA', keywords: ['iceland', 'reykjavik'] },
  singapore:    { gradient: 'linear-gradient(160deg, #F0FFF5 0%, #FFFFFF 32%, #F5FFF8 58%, #EDFFF5 100%)', accent: '#30D158', keywords: ['singapore'] },
  marrakech:    { gradient: 'linear-gradient(160deg, #FFF5E0 0%, #FFFFFF 32%, #FFF8E8 58%, #FFF2D8 100%)', accent: '#FF9F0A', keywords: ['marrakech', 'morocco'] },
  berlin:       { gradient: 'linear-gradient(160deg, #F0F0F8 0%, #FFFFFF 32%, #F2F2F8 58%, #EEEEFC 100%)', accent: '#5E5CE6', keywords: ['berlin', 'germany'] },
  sydney:       { gradient: 'linear-gradient(160deg, #EBF5FF 0%, #FFFFFF 32%, #EEF8FF 58%, #E8F4FF 100%)', accent: '#007AFF', keywords: ['sydney', 'australia'] },
  cancun:       { gradient: 'linear-gradient(160deg, #E8FFF8 0%, #FFFFFF 32%, #EDFFFE 58%, #E0FFF8 100%)', accent: '#00C7BE', keywords: ['cancun', 'mexico'] },
  default:      { gradient: 'linear-gradient(160deg, #EDF0FF 0%, #FFFFFF 40%, #F4F0FF 68%, #EEF4FF 100%)', accent: '#007AFF', keywords: [] },
};

function detectDestKey(msgs: UIMessage[]): string | null {
  const userMsgs = msgs.filter(m => m.role === 'user').map(m => getMessageText(m).toLowerCase());
  for (const text of userMsgs) {
    for (const [key, theme] of Object.entries(DEST_THEMES)) {
      if (key === 'default') continue;
      if (theme.keywords.some(kw => text.includes(kw))) return key;
    }
  }
  return null;
}

// Raw destination string for photo search (first user message trimmed)
function getRawDestination(msgs: UIMessage[]): string | null {
  const firstUser = msgs.find(m => m.role === 'user');
  if (!firstUser) return null;
  const text = getMessageText(firstUser).trim();
  return text.length > 1 && text.length < 60 ? text : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #6 — QUICK REPLY DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_REPLIES: Record<NonNullable<QuickReplyContext>, string[]> = {
  destination: ['Paris 🇫🇷', 'Tokyo 🇯🇵', 'New York 🗽', 'Dubai 🌆', 'Barcelona 🌊', 'Surprise me ✨'],
  dates:       ['Weekend (3 nights)', '5 nights', '1 week', '2 weeks', '1 month'],
  travelers:   ['Just me 🧳', '2 people ❤️', '3–4 people 👥', 'Family (5+) 👨‍👩‍👧‍👦'],
  budget:      ['$1,500', '$3,000', '$5,000', '$10,000', '$20,000+'],
  style:       ['Luxury & relax 🍾', 'Adventure 🏔️', 'Culture & food 🎭', 'Family fun 🎢', 'Backpacker 🎒'],
};

function detectQuickReplyContext(lastAIMsg: string): QuickReplyContext {
  const t = lastAIMsg.toLowerCase();
  if (t.includes('where') || t.includes('destination') || t.includes('dream') || t.includes('where to') || t.includes('have in mind')) return 'destination';
  if (t.includes('night') || t.includes('long') || t.includes('duration') || t.includes('days') || t.includes('when') || t.includes('how many')) return 'dates';
  if (t.includes('traveler') || t.includes('people') || t.includes('many of') || t.includes('who') || t.includes('group')) return 'travelers';
  if (t.includes('budget') || t.includes('spend') || t.includes('afford') || t.includes('cost') || t.includes('total')) return 'budget';
  if (t.includes('style') || t.includes('vibe') || t.includes('prefer') || t.includes('type of') || t.includes('interest') || t.includes('kind of')) return 'style';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #9 — BUDGET VIABILITY SIGNAL
// ─────────────────────────────────────────────────────────────────────────────

const DEST_COST_FACTOR: Record<string, number> = {
  paris: 1.4, tokyo: 1.3, dubai: 1.5, new_york: 1.6, london: 1.5,
  barcelona: 1.1, rome: 1.1, bali: 0.55, bangkok: 0.55, prague: 0.75,
  amsterdam: 1.3, lisbon: 1.0, maldives: 2.0, santorini: 1.3, iceland: 1.6,
  singapore: 1.4, berlin: 1.1, sydney: 1.4, madrid: 1.1, cancun: 0.9,
  default: 1.0,
};

function getBudgetSignal(input: string, destKey: string | null, collectedNights?: number): BudgetSignal | null {
  const match = input.replace(/,/g, '').match(/\$?\b(\d{3,6})\b/);
  if (!match) return null;
  const budget = parseInt(match[1]);
  if (isNaN(budget) || budget < 200) return null;

  const nights = collectedNights ?? 7;
  const factor = DEST_COST_FACTOR[destKey ?? 'default'] ?? 1.0;
  const perPersonPerDay = budget / Math.max(1, nights) / 2;
  const benchmark = 180 * factor;
  const ratio = perPersonPerDay / benchmark;

  if (ratio >= 1.2) return { level: 'green',  msg: `$${budget.toLocaleString()} — Comfortable, excellent options await ✨` };
  if (ratio >= 0.65) return { level: 'yellow', msg: `$${budget.toLocaleString()} — Solid budget, smart choices will shine 👍` };
  return { level: 'red', msg: `$${budget.toLocaleString()} — Tight — consider a bit more for a fuller experience` };
}

const SIGNAL_COLORS = { green: '#30D158', yellow: '#FF9F0A', red: '#FF453A' };

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTED FIELDS (for needs panel)
// ─────────────────────────────────────────────────────────────────────────────

function extractCollectedFields(msgs: UIMessage[]): CollectedFields {
  const userMsgs = msgs.filter(m => m.role === 'user').map(m => getMessageText(m).trim());
  return {
    destination: userMsgs[0],
    dates:       userMsgs[1],
    travelers:   userMsgs[2],
    budget:      userMsgs[3],
    style:       userMsgs[4],
  };
}

function extractNightsFromFields(fields: CollectedFields): number | undefined {
  if (!fields.dates) return undefined;
  const m = fields.dates.match(/(\d+)/);
  return m ? parseInt(m[1]) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT ORBS (light mode atmosphere)
// ─────────────────────────────────────────────────────────────────────────────

function AmbientOrbs({ accent }: { accent: string }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {([
        { top: '-16%', insetInlineStart: '-7%',  w: '54%', h: '60%', opacity: 0.55, delay: '0s',  dur: '22s' },
        { top: '-8%',  insetInlineEnd:  '-6%',   w: '46%', h: '50%', opacity: 0.40, delay: '8s',  dur: '26s' },
        { bottom: '-14%', insetInlineEnd: '5%',  w: '42%', h: '44%', opacity: 0.35, delay: '4s',  dur: '20s' },
        { bottom: '-6%',  insetInlineStart: '3%',w: '38%', h: '38%', opacity: 0.30, delay: '12s', dur: '24s' },
      ] as Array<{ top?: string; bottom?: string; insetInlineStart?: string; insetInlineEnd?: string; w: string; h: string; opacity: number; delay: string; dur: string }>).map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: b.top, bottom: b.bottom,
          insetInlineStart: b.insetInlineStart,
          insetInlineEnd: b.insetInlineEnd,
          width: b.w, height: b.h,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${accent}${Math.round(b.opacity * 255).toString(16).padStart(2, '0')} 0%, transparent 68%)`,
          animation: `breathe ${b.dur} ease-in-out infinite`,
          animationDelay: b.delay,
          transition: 'background 1.2s ease',
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN #3 — AI AVATAR (breathing animation)
// ─────────────────────────────────────────────────────────────────────────────

function AIAvatar({ isStreaming, size = 32 }: { isStreaming: boolean; size?: number }) {
  return (
    <motion.div
      animate={isStreaming
        ? { scale: [1, 1.14, 1], boxShadow: ['0 4px 14px rgba(0,122,255,0.26)', '0 6px 22px rgba(0,122,255,0.46)', '0 4px 14px rgba(0,122,255,0.26)'] }
        : { scale: [1, 1.055, 1], boxShadow: ['0 4px 14px rgba(0,122,255,0.22)', '0 4px 18px rgba(0,122,255,0.34)', '0 4px 14px rgba(0,122,255,0.22)'] }
      }
      transition={{ duration: isStreaming ? 0.65 : 3.8, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.30),
        flexShrink: 0,
        background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Sparkles size={Math.round(size * 0.44)} color="#fff" strokeWidth={2.2} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{
      display: 'flex', gap: 5, padding: '14px 16px',
      borderRadius: '6px 18px 18px 18px',
      background: 'rgba(255,255,255,0.96)',
      border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
    }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(0,122,255,0.50)' }}
          animate={{ y: [0, -6, 0], opacity: [0.40, 1, 0.40] }}
          transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN #5 — MESSAGE BUBBLE (depth recession)
// ─────────────────────────────────────────────────────────────────────────────

function Bubble({ msg, distFromEnd }: { msg: UIMessage; distFromEnd: number }) {
  const isUser = msg.role === 'user';
  const text = getMessageText(msg);
  if (!text.trim()) return null;

  const opacity = distFromEnd === 0 ? 1 : Math.max(0.58, 1 - distFromEnd * 0.11);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity, y: 0, scale: 1 }}
      transition={SP}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 10, transition: 'opacity 0.5s ease' }}
    >
      {!isUser && <AIAvatar isStreaming={false} />}
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
          ? '0 6px 24px rgba(0,122,255,0.34)'
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

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN #2 — BOARDING PASS PROGRESS STRIP
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Destination', icon: MapPin  },
  { label: 'Dates',       icon: Clock   },
  { label: 'Travelers',   icon: Users   },
  { label: 'Budget',      icon: Wallet  },
  { label: 'Style',       icon: Sparkles },
];

function ProgressStrip({ progress }: { progress: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {STEPS.map(({ label, icon: Icon }, i) => {
        const done   = i < progress;
        const active = i === progress;
        const color  = done ? '#30D158' : active ? '#007AFF' : 'rgba(0,0,0,0.22)';
        return (
          <React.Fragment key={label}>
            <motion.div
              animate={{
                background: done ? 'rgba(48,209,88,0.11)' : active ? 'rgba(0,122,255,0.09)' : 'rgba(0,0,0,0.04)',
                scale: active ? 1.05 : 1,
              }}
              transition={{ duration: 0.24 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 3.5,
                padding: '4px 8px', borderRadius: 100,
                border: `1px solid ${done ? 'rgba(48,209,88,0.24)' : active ? 'rgba(0,122,255,0.20)' : 'rgba(0,0,0,0.07)'}`,
              }}
            >
              {done
                ? <Check size={10} color="#30D158" strokeWidth={3} />
                : <Icon  size={10} color={color}   strokeWidth={2.2} />
              }
              <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </motion.div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 6, height: 1, borderRadius: 1, background: i < progress ? 'rgba(48,209,88,0.28)' : 'rgba(0,0,0,0.09)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN #4 — NEEDS PANEL (collected data chips)
// ─────────────────────────────────────────────────────────────────────────────

function NeedsPanel({ fields }: { fields: CollectedFields }) {
  const chips = [
    fields.destination && { icon: MapPin,  color: '#007AFF', value: fields.destination.split(' ').slice(0, 3).join(' ') },
    fields.dates       && { icon: Clock,   color: '#FF9F0A', value: fields.dates.split(' ').slice(0, 4).join(' ') },
    fields.travelers   && { icon: Users,   color: '#30D158', value: fields.travelers.split(' ').slice(0, 3).join(' ') },
    fields.budget      && { icon: Wallet,  color: '#BF5AF2', value: fields.budget.split(' ').slice(0, 3).join(' ') },
  ].filter(Boolean) as Array<{ icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; color: string; value: string }>;

  if (chips.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingInline: '24px', paddingBottom: 6, justifyContent: 'center' }}
    >
      {chips.map(({ icon: Icon, color, value }, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28, delay: i * 0.06 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 100,
            background: `${color}09`,
            border: `1px solid ${color}1F`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <Icon size={9} color={color} strokeWidth={2.5} />
          <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '-0.01em', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #6 — QUICK REPLY CHIPS
// ─────────────────────────────────────────────────────────────────────────────

function QuickReplies({ context, onSelect }: { context: QuickReplyContext; onSelect: (t: string) => void }) {
  if (!context) return null;
  const replies = QUICK_REPLIES[context];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
      transition={SP}
      style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingInline: '24px', paddingBottom: 6 }}
    >
      {replies.map((reply, i) => (
        <motion.button
          key={reply}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28, delay: i * 0.04 }}
          whileHover={{ scale: 1.05, y: -1, boxShadow: '0 6px 20px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(reply)}
          style={{
            padding: '7px 14px', borderRadius: 100,
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid rgba(0,0,0,0.10)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
            fontSize: 12, fontWeight: 600, color: '#1D1D1F',
            cursor: 'pointer', fontFamily: 'inherit',
            letterSpacing: '-0.01em',
          }}
        >
          {reply}
        </motion.button>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-COMMIT ZONE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_ACTIONS = [
  { emoji: '✈️', label: 'Search Flights',    zone: 'flights',     color: '#007AFF', bg: 'rgba(0,122,255,0.07)',   border: 'rgba(0,122,255,0.18)'  },
  { emoji: '🏨', label: 'Browse Hotels',     zone: 'lodging',     color: '#5AC8FA', bg: 'rgba(90,200,250,0.07)',  border: 'rgba(90,200,250,0.20)' },
  { emoji: '🍽️', label: 'Find Restaurants', zone: 'dining',      color: '#FF9F0A', bg: 'rgba(255,159,10,0.07)',  border: 'rgba(255,159,10,0.18)' },
  { emoji: '⭐', label: 'Experiences',       zone: 'attractions', color: '#30D158', bg: 'rgba(48,209,88,0.07)',   border: 'rgba(48,209,88,0.18)'  },
  { emoji: '🗺️', label: 'Full Itinerary',   zone: 'management',  color: '#BF5AF2', bg: 'rgba(191,90,242,0.07)',  border: 'rgba(191,90,242,0.18)' },
];

function PostCommitActions({ onNavigate }: { onNavigate: (zone: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, ...SP }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBlock: 4 }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
        Where to next?
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {ZONE_ACTIONS.map((a, i) => (
          <motion.button
            key={a.zone}
            initial={{ scale: 0.78, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28, delay: 0.36 + i * 0.055 }}
            whileHover={{ scale: 1.07, y: -2, boxShadow: `0 8px 24px ${a.color}28, inset 0 1px 0 rgba(255,255,255,1)` }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onNavigate(a.zone)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 100,
              background: a.bg, border: `1.5px solid ${a.border}`,
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              boxShadow: `0 2px 10px ${a.color}14, inset 0 1px 0 rgba(255,255,255,0.90)`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 13 }}>{a.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>{a.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP READY CARD
// ─────────────────────────────────────────────────────────────────────────────

function TripReadyCard({ tripData, onView }: { tripData: CommitTripArgs; onView: () => void }) {
  const STATS = [
    { icon: MapPin,  label: 'Destination', value: tripData.destination,                       color: '#007AFF' },
    { icon: Clock,   label: 'Duration',    value: `${tripData.nights} nights`,                color: '#FF9F0A' },
    { icon: Users,   label: 'Travelers',   value: String(tripData.travelers),                 color: '#30D158' },
    { icon: Wallet,  label: 'Budget',      value: `$${tripData.budget.toLocaleString()}`,     color: '#BF5AF2' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPF}
      style={{
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid rgba(255,255,255,1)',
        borderRadius: 26, padding: '26px 24px',
        backdropFilter: 'blur(56px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(56px) saturate(1.9)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.10), 0 6px 24px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1)',
        position: 'relative', overflow: 'hidden',
      }}
    >
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
          <div key={label} style={{ padding: '12px 14px', borderRadius: 16, background: `${color}09`, border: `1px solid ${color}1C` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Icon size={10} color={color} strokeWidth={2.2} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #8 — RESUME BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ResumeBanner({ onContinue, onFresh }: { onContinue: () => void; onFresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: '12px 24px 0',
        padding: '13px 16px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid rgba(0,122,255,0.18)',
        boxShadow: '0 4px 18px rgba(0,122,255,0.10), inset 0 1px 0 rgba(255,255,255,1)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,122,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock size={13} color="#007AFF" strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.015em' }}>Continue previous session?</div>
        <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, marginTop: 2 }}>Pick up where you left off</div>
      </div>
      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onContinue}
          style={{ padding: '6px 12px', borderRadius: 100, background: '#007AFF', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: '#fff', boxShadow: '0 3px 10px rgba(0,122,255,0.32)' }}>
          Continue
        </motion.button>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onFresh}
          style={{ padding: '6px 12px', borderRadius: 100, background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.10)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: '#3C3C43' }}>
          Start fresh
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME HERO — empty state before first message
// ─────────────────────────────────────────────────────────────────────────────

const WELCOME_DEST_CHIPS = [
  'Paris 🇫🇷', 'Tokyo 🇯🇵', 'New York 🗽', 'Dubai 🌆',
  'Barcelona 🌊', 'Bali 🌿', 'London 🎭', 'Maldives 🐠',
];

function WelcomeHero({ onSelect }: { onSelect: (t: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -12, transition: { duration: 0.18 } }}
      transition={SPF}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '0 32px 16px',
        fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
      }}
    >
      {/* Large AI logo */}
      <motion.div
        animate={{
          scale: [1, 1.06, 1],
          boxShadow: [
            '0 10px 36px rgba(0,122,255,0.28)',
            '0 14px 48px rgba(0,122,255,0.46)',
            '0 10px 36px rgba(0,122,255,0.28)',
          ],
        }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 36px rgba(0,122,255,0.28)',
          marginBottom: 28,
        }}
      >
        <Sparkles size={36} color="#fff" strokeWidth={1.8} />
      </motion.div>

      {/* Headline */}
      <h1 style={{
        fontSize: 'clamp(30px, 4.2vw, 46px)', fontWeight: 900,
        color: '#1D1D1F', letterSpacing: '-0.04em',
        lineHeight: 1.05, margin: '0 0 14px',
        fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
      }}>
        Where would you<br />like to go?
      </h1>

      {/* Subtitle */}
      <p style={{
        fontSize: 16, fontWeight: 400, color: '#6E6E73',
        letterSpacing: '-0.015em', lineHeight: 1.55,
        margin: '0 0 36px', maxWidth: 380,
      }}>
        Tell me your dream destination and I&apos;ll plan an extraordinary trip
      </p>

      {/* Destination quick-pick chips */}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
        {WELCOME_DEST_CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28, delay: 0.12 + i * 0.05 }}
            whileHover={{ scale: 1.06, y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.11), inset 0 1px 0 rgba(255,255,255,1)' }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onSelect(chip)}
            style={{
              padding: '9px 18px', borderRadius: 100,
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(0,0,0,0.10)',
              boxShadow: '0 3px 12px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
              fontSize: 13.5, fontWeight: 600, color: '#1D1D1F',
              cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            {chip}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER CHAT (uses useChat hook — must be a stable component for key remount)
// ─────────────────────────────────────────────────────────────────────────────

function GuidedJourneyInner({ initialMessages, onSwitch, onFresh }: {
  initialMessages: UIMessage[];
  onSwitch: () => void;
  onFresh: () => void;
}) {
  const router      = useRouter();
  const setupTrip   = useTravelEngine(s => s.setupTrip);
  const addDay      = useTravelEngine(s => s.addDay);
  const completeDNA = useTravelEngine(s => s.completeTravelDNA);

  const [tripData,    setTripData]    = useState<CommitTripArgs | null>(null);
  const [inputVal,    setInputVal]    = useState('');
  const [destPhoto,   setDestPhoto]   = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<unknown>(null);

  const { messages, sendMessage, status } = useChat<UIMessage>({
    transport: new DefaultChatTransport({ api: '/api/onboarding' }),
    messages:  initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // ── Auto-send prefill query from main-stage search input ─────────────────
  useEffect(() => {
    if (initialMessages.length > 0) return;
    try {
      const prefill = sessionStorage.getItem('unitravel:onboarding:prefill');
      if (!prefill) return;
      sessionStorage.removeItem('unitravel:onboarding:prefill');
      const t = setTimeout(() => {
        sendMessage({ role: 'user', parts: [{ type: 'text', text: prefill }] });
      }, 200);
      return () => clearTimeout(t);
    } catch {}
  }, []); // eslint-disable-line

  // ── Persist messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(CONVO_LS_KEY, JSON.stringify(messages)); } catch {}
    }
  }, [messages]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const destKey       = useMemo(() => detectDestKey(messages), [messages]);
  const rawDest       = useMemo(() => getRawDestination(messages), [messages]);
  const theme         = DEST_THEMES[destKey ?? 'default'] ?? DEST_THEMES.default;
  const fields        = useMemo(() => extractCollectedFields(messages), [messages]);
  const collectedNights = extractNightsFromFields(fields);

  const lastAIText    = useMemo(() => {
    const aiMsgs = messages.filter(m => m.role === 'assistant');
    return aiMsgs.length > 0 ? getMessageText(aiMsgs[aiMsgs.length - 1]) : '';
  }, [messages]);
  const qrContext     = useMemo(() => detectQuickReplyContext(lastAIText), [lastAIText]);
  const budgetSignal  = useMemo(() => getBudgetSignal(inputVal, destKey, collectedNights), [inputVal, destKey, collectedNights]);

  const aiMsgCount    = messages.filter(m => m.role === 'assistant' && getMessageText(m).trim()).length;
  const progress      = Math.min(5, Math.max(0, aiMsgCount - 1));

  const allMsgs       = messages.filter(m => getMessageText(m).trim());

  // ── Feature #7: Fetch destination photo ───────────────────────────────────
  useEffect(() => {
    if (!rawDest || destPhoto) return;
    const q = rawDest;
    fetch(`/api/destination-photo?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { if (d.url) setDestPhoto(d.url); })
      .catch(() => {});
  }, [rawDest, destPhoto]);

  const navigatedRef = useRef(false);

  // ── Detect commitTrip ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tripData) return;
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.toolName === 'commitTrip' && dp.state === 'output-available') {
          const result = dp.output as CommitTripArgs;
          if (result?.committed) { setTripData(result); commitToStore(result); }
        }
      }
    }
  }, [messages, tripData]); // eslint-disable-line

  // ── Detect navigateZone — close GuidedJourney then push route ─────────────
  useEffect(() => {
    if (navigatedRef.current) return;
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'dynamic-tool') continue;
        const dp = part as DynamicToolUIPart;
        if (dp.toolName === 'navigateZone' && dp.state === 'output-available') {
          const result = dp.output as { zone: string; navigated: boolean };
          if (result?.navigated && result.zone) {
            navigatedRef.current = true;
            setTimeout(() => { onSwitch(); router.push(`/zone/${result.zone}`); }, 900);
          }
        }
      }
    }
  }, [messages]); // eslint-disable-line

  const commitToStore = useCallback((data: CommitTripArgs) => {
    const today = new Date();
    const start = data.startDate
      ? new Date(data.startDate)
      : (() => { const d = new Date(today); d.setDate(today.getDate() + 14); return d; })();
    const nights = Math.max(1, data.nights);
    const end = new Date(start); end.setDate(start.getDate() + nights);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const prefLower = data.preferences.toLowerCase();
    const dna = FinancialEngine.deriveDNAFromSelections({
      paceIndex: prefLower.includes('relax') || prefLower.includes('slow') ? 0.15 : prefLower.includes('adventure') || prefLower.includes('active') ? 0.85 : 0.5,
      diningSelections: data.budget >= 10000 ? ['michelin', 'fine-dining'] : data.budget >= 4000 ? ['fine-dining', 'contemporary'] : ['contemporary', 'local'],
      basecampSelection: data.budget >= 10000 ? 'ultra-luxury' : data.budget >= 4000 ? 'design-hotel' : 'boutique',
      activitySelections: prefLower.includes('cultur') ? ['culture'] : prefLower.includes('adventur') ? ['adventure'] : prefLower.includes('wellness') ? ['wellness'] : [],
    });
    completeDNA(dna);

    setupTrip({
      title: `Trip to ${data.destination}`,
      travelers: Array.from({ length: data.travelers }, (_, i) => `Traveler ${i + 1}`),
      startDate: fmt(start), endDate: fmt(end), nights, totalBudget: data.budget,
    });

    for (let i = 0; i < nights; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      addDay({ id: `day-${i + 1}`, date: fmt(d), dayNumber: i + 1, destination: data.destination, entities: [], budget: Math.round(data.budget / nights), weather: { temp: 22, icon: '☀️', condition: 'Sunny' } });
    }
    try { localStorage.removeItem(CONVO_LS_KEY); } catch {}
  }, [completeDNA, setupTrip, addDay]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = useCallback((text?: string) => {
    const t = (text ?? inputVal).trim();
    if (!t || isStreaming) return;
    setInputVal('');
    sendMessage({ role: 'user', parts: [{ type: 'text', text: t }] });
  }, [inputVal, isStreaming, sendMessage]);

  // ── Feature #10: Voice input ──────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SR = typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : null;
    if (!SR) return;

    if (isListening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setIsListening(false);
      return;
    }

    const rec = new (SR as new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void;
      onend: () => void; onerror: () => void;
      start: () => void; stop: () => void;
    })();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInputVal(transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        // Design #1: atmosphere gradient (transitions smoothly)
        background: theme.gradient,
        transition: 'background 1.4s ease',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
      }}
    >
      {/* Feature #7: Destination photo background layer */}
      <AnimatePresence>
        {destPhoto && (
          <motion.div
            key="dest-photo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8 }}
            aria-hidden
            style={{
              position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
              backgroundImage: `url(${destPhoto})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'blur(60px) saturate(1.2)',
              transform: 'scale(1.08)',
              opacity: 0.18,
            }}
          />
        )}
      </AnimatePresence>

      <AmbientOrbs accent={theme.accent} />

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.90)',
        gap: 12,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <AIAvatar isStreaming={isStreaming} size={28} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1 }}>Unit AI</div>
            <div style={{ fontSize: 9, fontWeight: 500, color: '#8E8E93', marginTop: 1 }}>Travel Concierge</div>
          </div>
        </div>

        {/* Design #2: Boarding pass progress strip — center */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
          <ProgressStrip progress={progress} />
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <motion.button
            onClick={onFresh}
            whileHover={{ scale: 1.06, background: 'rgba(0,0,0,0.07)' }}
            whileTap={{ scale: 0.94 }}
            title="Start fresh"
            style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(0,0,0,0.09)',
              background: 'rgba(0,0,0,0.05)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={11} color="#6E6E73" strokeWidth={2.5} />
          </motion.button>
          <motion.button
            onClick={onSwitch}
            whileHover={{ scale: 1.04, background: 'rgba(0,0,0,0.07)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 100,
              background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.09)',
              color: '#3C3C43', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
            }}
          >
            <LayoutGrid size={11} color="#3C3C43" />
            Manual mode
          </motion.button>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 24px 12px',
        display: 'flex', flexDirection: 'column', gap: 14,
        scrollbarWidth: 'none', position: 'relative', zIndex: 1,
        maxWidth: 720, width: '100%', marginInline: 'auto', boxSizing: 'border-box',
        justifyContent: allMsgs.length === 0 ? 'center' : 'flex-start',
      }}>
        <AnimatePresence>
          {allMsgs.length === 0 && !isStreaming && (
            <WelcomeHero key="welcome-hero" onSelect={t => handleSend(t)} />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {allMsgs.map((msg, i) => (
            <Bubble key={msg.id} msg={msg} distFromEnd={allMsgs.length - 1 - i} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isStreaming && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SP}
              style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <AIAvatar isStreaming={true} />
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {tripData && (
            <TripReadyCard key="trip-ready" tripData={tripData} onView={() => router.push('/zone/management')} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {tripData && !isStreaming && (
            <PostCommitActions
              key="post-commit"
              onNavigate={(zone) => { onSwitch(); router.push(`/zone/${zone}`); }}
            />
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom area ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 720, width: '100%', marginInline: 'auto', boxSizing: 'border-box' }}>

          {/* Design #4: Needs panel */}
          <NeedsPanel fields={fields} />

          {/* Feature #6: Quick reply chips */}
          <AnimatePresence>
            {!isStreaming && qrContext && allMsgs.length > 0 && (
              <QuickReplies key={qrContext} context={qrContext} onSelect={t => handleSend(t)} />
            )}
          </AnimatePresence>

          {/* Feature #9: Budget viability signal */}
          <AnimatePresence>
            {budgetSignal && (
              <motion.div
                key="budget-signal"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                style={{
                  marginInline: '24px', marginBottom: 6,
                  padding: '7px 13px', borderRadius: 12,
                  background: `${SIGNAL_COLORS[budgetSignal.level]}0C`,
                  border: `1px solid ${SIGNAL_COLORS[budgetSignal.level]}22`,
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: SIGNAL_COLORS[budgetSignal.level], flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: SIGNAL_COLORS[budgetSignal.level], letterSpacing: '-0.01em' }}>
                  {budgetSignal.msg}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...SP }}
            style={{
              padding: '0 16px 28px',
              background: 'linear-gradient(0deg, rgba(245,245,250,0.97) 0%, rgba(245,245,250,0.85) 70%, transparent 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid rgba(0,0,0,0.09)',
              borderRadius: 20,
              padding: '11px 11px 11px 17px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
            }}>
              <textarea
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={isListening ? '🎤 Listening…' : allMsgs.length === 0 ? 'Where would you like to go?' : 'Type your answer…'}
                rows={1}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#1D1D1F', fontSize: 14.5, fontWeight: 400,
                  fontFamily: 'inherit', letterSpacing: '-0.01em', lineHeight: 1.5,
                  resize: 'none', minHeight: 22, maxHeight: 120, overflowY: 'auto', scrollbarWidth: 'none',
                }}
              />

              {/* Feature #10: Voice button */}
              <motion.button
                onClick={toggleVoice}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                style={{
                  width: 36, height: 36, borderRadius: 11, border: 'none',
                  background: isListening ? 'rgba(255,69,58,0.10)' : 'rgba(0,0,0,0.04)',
                  cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isListening ? '0 0 0 2px rgba(255,69,58,0.28)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isListening
                  ? <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 0.5, repeat: Infinity }}><MicOff size={14} color="#FF453A" strokeWidth={2.5} /></motion.div>
                  : <Mic size={14} color="rgba(0,0,0,0.32)" strokeWidth={2.5} />
                }
              </motion.button>

              {/* Send button */}
              <motion.button
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || isStreaming}
                whileHover={{ scale: inputVal.trim() ? 1.08 : 1 }}
                whileTap={{ scale: inputVal.trim() ? 0.94 : 1 }}
                style={{
                  width: 36, height: 36, borderRadius: 11, border: 'none',
                  background: inputVal.trim() && !isStreaming
                    ? 'linear-gradient(135deg, #007AFF, #5856D6)'
                    : 'rgba(0,0,0,0.06)',
                  cursor: inputVal.trim() && !isStreaming ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#AEAEB2', letterSpacing: '0.01em' }}>
              Enter to send · Shift+Enter for newline
            </div>
          </motion.div>
        </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTER WRAPPER — manages session persistence + remounting
// ─────────────────────────────────────────────────────────────────────────────

export function GuidedJourney({ onSwitch }: { onSwitch: () => void }) {
  const [sessionKey,        setSessionKey]        = useState(0);
  const [showResumeBanner,  setShowResumeBanner]  = useState(false);
  const [savedMessages,     setSavedMessages]     = useState<UIMessage[]>([]);
  const [resolvedMessages,  setResolvedMessages]  = useState<UIMessage[] | null>(null);

  // Feature #8: Check for saved session after mount
  useEffect(() => {
    try {
      const s = localStorage.getItem(CONVO_LS_KEY);
      if (!s) return;
      const msgs = JSON.parse(s) as UIMessage[];
      if (msgs.length > 1) {
        setSavedMessages(msgs);
        setShowResumeBanner(true);
      }
    } catch {}
  }, []);

  const handleContinue = useCallback(() => {
    setResolvedMessages(savedMessages);
    setShowResumeBanner(false);
  }, [savedMessages]);

  const handleFresh = useCallback(() => {
    try { localStorage.removeItem(CONVO_LS_KEY); } catch {}
    setSavedMessages([]);
    setShowResumeBanner(false);
    setResolvedMessages([]);
    setSessionKey(k => k + 1); // remounts GuidedJourneyInner
  }, []);

  // Before user resolves the banner, don't render the inner chat
  // (avoids starting a fresh AI greeting that'd conflict with resume)
  const initialMessages = resolvedMessages ?? (showResumeBanner ? null : []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: DEST_THEMES.default.gradient,
        fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <AmbientOrbs accent="#007AFF" />

      {/* Feature #8: Resume banner */}
      <AnimatePresence>
        {showResumeBanner && (
          <div style={{ position: 'relative', zIndex: 10 }}>
            <ResumeBanner onContinue={handleContinue} onFresh={handleFresh} />
          </div>
        )}
      </AnimatePresence>

      {/* Render inner chat once session is resolved */}
      {initialMessages !== null && (
        <GuidedJourneyInner
          key={sessionKey}
          initialMessages={initialMessages}
          onSwitch={onSwitch}
          onFresh={handleFresh}
        />
      )}
    </motion.div>
  );
}
