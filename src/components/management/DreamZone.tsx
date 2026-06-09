'use client';

/**
 * DreamZone — Unitravel's sandbox trip planning canvas.
 *
 * Innovations vs. every competitor:
 *  1. Three parallel dream slots (A / B / C) for side-by-side what-if exploration
 *  2. Vibe-seed chips that context-prime the AI before a single word is typed
 *  3. AI Rebuild with memory — one click re-plans while preserving stated preferences
 *  4. Budget Arc — temporal spend curve across all days (not just a total)
 *  5. Day-color identity system — every day has its own accent propagated through all cards
 *
 * Design:
 *  6. Glassmorphic slot tabs with live budgets
 *  7. Micro-spring entity arrival animation (per-index stagger)
 *  8. Glowing vibe chips with active shimmer
 *  9. Gradient day-header bands keyed to the day's color
 * 10. Animated cursor "▋" typewriter during AI streaming
 */

import {
  useState, useCallback, useEffect, useRef, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat }                 from '@ai-sdk/react';
import { DefaultChatTransport }    from 'ai';
import { useTravelEngine }         from '@/store/useTravelEngine';
import { useToast }                from '@/components/ui/Toast';
import {
  Sparkles, Hammer, Plane, Hotel, UtensilsCrossed, Compass, Train,
  Plus, X, Send, ArrowRight, Trash2, RefreshCw, MapPin,
  DollarSign, ChevronDown, CheckCircle2,
  RotateCcw, Calendar, Zap, Copy,
  Waves, Library, Mountain, Star, Leaf, Building2, Heart,
} from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;
const AZURE  = '#007AFF';
const VIOLET = '#5E5CE6';

// DAY COLOR PALETTE — each day gets its own accent
const DAY_PALETTE = [
  '#007AFF', '#BF5AF2', '#30D158', '#FF9F0A',
  '#FF453A', '#5AC8FA', '#FF6B35', '#64D2FF',
];
function dayColor(n: number) { return DAY_PALETTE[(n - 1) % DAY_PALETTE.length]; }

// CATEGORY CONFIG
const CAT_CONFIG = {
  flight:     { icon: Plane,           label: 'Flight',     color: '#007AFF', bg: 'rgba(0,122,255,0.09)',  border: 'rgba(0,122,255,0.22)'  },
  hotel:      { icon: Hotel,           label: 'Hotel',      color: '#5E5CE6', bg: 'rgba(94,92,230,0.09)',  border: 'rgba(94,92,230,0.22)'  },
  restaurant: { icon: UtensilsCrossed, label: 'Dining',     color: '#FF9F0A', bg: 'rgba(255,159,10,0.09)', border: 'rgba(255,159,10,0.22)' },
  activity:   { icon: Compass,         label: 'Experience', color: '#30D158', bg: 'rgba(48,209,88,0.09)',  border: 'rgba(48,209,88,0.22)'  },
  transport:  { icon: Train,           label: 'Transit',    color: '#BF5AF2', bg: 'rgba(191,90,242,0.09)', border: 'rgba(191,90,242,0.22)' },
} as const;
type Category = keyof typeof CAT_CONFIG;

// VIBE SEEDS
const VIBES: Array<{
  id:    string;
  icon:  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  color: string;
}> = [
  { id: 'beach',     icon: Waves,          label: 'Beach',     color: '#5AC8FA' },
  { id: 'culture',   icon: Library,        label: 'Culture',   color: '#FF9F0A' },
  { id: 'adventure', icon: Mountain,       label: 'Adventure', color: '#30D158' },
  { id: 'luxury',    icon: Star,           label: 'Luxury',    color: '#FFD700' },
  { id: 'food',      icon: UtensilsCrossed,label: 'Foodie',    color: '#FF6B35' },
  { id: 'nature',    icon: Leaf,           label: 'Nature',    color: '#34C759' },
  { id: 'city',      icon: Building2,      label: 'City',      color: '#007AFF' },
  { id: 'romance',   icon: Heart,          label: 'Romance',   color: '#FF453A' },
];
type VibeId = string;

// DREAM SLOTS
const SLOT_LABELS = ['A', 'B', 'C'] as const;
type SlotLabel = typeof SLOT_LABELS[number];
const SLOT_COLORS: Record<SlotLabel, string> = { A: AZURE, B: '#BF5AF2', C: '#30D158' };

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DreamEntity {
  id:        string;
  category:  Category;
  title:     string;
  subtitle:  string;
  price:     number;
  time?:     string;
  duration?: string;
  details:   Record<string, string | number | boolean>;
}

export interface DreamDay {
  id:          string;
  dayNumber:   number;
  date:        string;
  destination: string;
  entities:    DreamEntity[];
}

interface DreamSlot {
  label:       SlotLabel;
  title:       string;
  days:        DreamDay[];
  savedAt:     number;
}

const STORAGE_KEY = 'unitravel:dream:v2';

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function emptySlot(label: SlotLabel): DreamSlot {
  return { label, title: '', days: [], savedAt: 0 };
}

function parseDreamJSON(text: string): Partial<{ title: string; totalBudget: number; days: DreamDay[] }> | null {
  const match = text.match(/<DREAM_ITINERARY>([\s\S]*?)<\/DREAM_ITINERARY>/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1].trim()) as {
      title?: string; totalBudget?: number;
      days?: Array<{
        dayNumber?: number; destination?: string; date?: string;
        entities?: Array<{ category?: string; title?: string; subtitle?: string; price?: number; time?: string; duration?: string; details?: Record<string, string | number | boolean> }>;
      }>;
    };
    return {
      title:       raw.title ?? 'Dream Trip',
      totalBudget: raw.totalBudget ?? 0,
      days: (raw.days ?? []).map((d, i) => ({
        id:          uid(),
        dayNumber:   d.dayNumber ?? i + 1,
        date:        d.date ?? '',
        destination: d.destination ?? 'Destination',
        entities: (d.entities ?? []).map(e => ({
          id:       uid(),
          category: (Object.keys(CAT_CONFIG).includes(e.category ?? '') ? e.category : 'activity') as Category,
          title:    e.title    ?? 'Untitled',
          subtitle: e.subtitle ?? '',
          price:    e.price    ?? 0,
          time:     e.time,
          duration: e.duration,
          details:  e.details  ?? {},
        })),
      })),
    };
  } catch { return null; }
}

function narrativeOnly(text: string): string {
  return text.replace(/<DREAM_ITINERARY>[\s\S]*?<\/DREAM_ITINERARY>/g, '').trim();
}

function msgText(parts: Array<{ type: string; text?: string }>): string {
  return (parts ?? []).filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('');
}

// ── BudgetArc ──────────────────────────────────────────────────────────────────

const BudgetArc = memo(function BudgetArc({ days }: { days: DreamDay[] }) {
  if (days.length < 2) return null;
  const spends = days.map(d => d.entities.reduce((s, e) => s + e.price, 0));
  const max    = Math.max(...spends, 1);
  const W = 120, H = 28;
  const barW = Math.max(2, (W - (days.length - 1) * 2) / days.length);

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {spends.map((spend, i) => {
        const x    = i * (barW + 2);
        const barH = Math.max(2, (spend / max) * (H - 4));
        const y    = H - barH;
        const col  = dayColor(i + 1);
        return (
          <motion.rect
            key={i}
            x={x} y={y} width={barW} height={barH} rx={2}
            fill={col}
            initial={{ height: 0, y: H }}
            animate={{ height: barH, y }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            opacity={spend > 0 ? 0.85 : 0.15}
          />
        );
      })}
    </svg>
  );
});

// ── DreamEntityCard ────────────────────────────────────────────────────────────

const DreamEntityCard = memo(function DreamEntityCard({
  entity, onRemove, index, accentColor,
}: {
  entity: DreamEntity; onRemove: (id: string) => void; index: number; accentColor: string;
}) {
  const cfg  = CAT_CONFIG[entity.category];
  const Icon = cfg.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -14, scale: 0.94 }}
      animate={{ opacity: 1, x: 0,   scale: 1   }}
      exit={{ opacity: 0, x: 12, scale: 0.94, height: 0, marginBottom: 0 }}
      transition={{ ...SPRING, delay: index * 0.035 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 11px 8px 14px', borderRadius: 12,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Day-accent left bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accentColor, borderRadius: '12px 0 0 12px' }} />
      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: `${cfg.color}14`, border: `1px solid ${cfg.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={11} color={cfg.color} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.018em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entity.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1.5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: `${cfg.color}12`, borderRadius: 4, padding: '1px 5px' }}>{cfg.label}</span>
          {entity.subtitle && <span style={{ fontSize: 10, color: '#6E6E73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.subtitle}</span>}
          {entity.time && <span style={{ fontSize: 10, color: '#AEAEB2', flexShrink: 0 }}>· {entity.time}</span>}
        </div>
      </div>
      {entity.price > 0 && (
        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', flexShrink: 0 }}>${entity.price.toLocaleString()}</span>
      )}
      <motion.button type="button"
        whileHover={{ scale: 1.15, background: 'rgba(255,69,58,0.12)' }}
        whileTap={{ scale: 0.88 }}
        onClick={() => onRemove(entity.id)}
        style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.14s' }}
      >
        <X size={9} color="#8E8E93" strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  );
});

// ── DreamDayCard ───────────────────────────────────────────────────────────────

function DreamDayCard({
  day, isActive, onActivate, onRemoveEntity, onRemoveDay, onRenameDestination,
}: {
  day: DreamDay; isActive: boolean;
  onActivate: (id: string) => void;
  onRemoveEntity: (dayId: string, entityId: string) => void;
  onRemoveDay: (dayId: string) => void;
  onRenameDestination: (dayId: string, dest: string) => void;
}) {
  const [editingDest, setEditingDest] = useState(false);
  const [destVal,     setDestVal]     = useState(day.destination);
  const col      = dayColor(day.dayNumber);
  const daySpend = day.entities.reduce((s, e) => s + e.price, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, height: 0, marginBottom: 0 }}
      transition={SPRING}
      style={{
        borderRadius: 16, overflow: 'hidden',
        background: 'rgba(255,255,255,0.88)',
        border: `1.5px solid ${isActive ? col + '40' : 'rgba(255,255,255,0.92)'}`,
        boxShadow: isActive
          ? `0 4px 20px ${col}18, inset 0 1px 0 rgba(255,255,255,0.95)`
          : '0 2px 10px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Day color top stripe */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${col}, ${col}88)`, flexShrink: 0 }} />

      {/* Header */}
      <div
        onClick={() => onActivate(day.id)}
        style={{ padding: '9px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: `${col}08`, borderBottom: '1px solid rgba(0,0,0,0.04)' }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: isActive ? col : `${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: isActive ? '#fff' : col, transition: 'background 0.2s, color 0.2s' }}>
          {day.dayNumber}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingDest ? (
            <input
              autoFocus
              value={destVal}
              onChange={e => setDestVal(e.target.value)}
              onBlur={() => { onRenameDestination(day.id, destVal); setEditingDest(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { onRenameDestination(day.id, destVal); setEditingDest(false); } }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'rgba(255,255,255,0.90)', border: `1.5px solid ${col}40`, borderRadius: 8, padding: '3px 8px', fontSize: 12.5, fontWeight: 700, color: '#1D1D1F', outline: 'none', fontFamily: 'inherit', width: '100%', letterSpacing: '-0.02em' }}
            />
          ) : (
            <div onDoubleClick={e => { e.stopPropagation(); setEditingDest(true); }} title="Double-click to rename" style={{ fontSize: 12.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {day.destination || `Day ${day.dayNumber}`}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 1 }}>
            {day.entities.length} item{day.entities.length !== 1 ? 's' : ''}
            {daySpend > 0 && <span style={{ color: '#AEAEB2' }}> · ${daySpend.toLocaleString()}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div animate={{ rotate: isActive ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={12} color="#8E8E93" strokeWidth={2} />
          </motion.div>
          <motion.button type="button"
            whileHover={{ scale: 1.15, background: 'rgba(255,69,58,0.12)' }}
            whileTap={{ scale: 0.88 }}
            onClick={e => { e.stopPropagation(); onRemoveDay(day.id); }}
            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.14s' }}
          >
            <Trash2 size={9} color="#FF453A" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>

      {/* Entity list */}
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {day.entities.length === 0 ? (
                <div style={{ padding: '10px', textAlign: 'center', color: '#AEAEB2', fontSize: 11, fontStyle: 'italic' }}>
                  No items yet — add from the builder →
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {day.entities
                    .slice().sort((a, b) => (a.time ?? '00:00').localeCompare(b.time ?? '00:00'))
                    .map((entity, i) => (
                      <DreamEntityCard key={entity.id} entity={entity} index={i} accentColor={col} onRemove={id => onRemoveEntity(day.id, id)} />
                    ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── DreamCanvas ────────────────────────────────────────────────────────────────

function DreamCanvas({
  days, activeDayId, onActivate, onRemoveEntity, onRemoveDay, onAddDay, onRenameDestination,
}: {
  days: DreamDay[]; activeDayId: string | null;
  onActivate: (id: string) => void;
  onRemoveEntity: (dayId: string, entityId: string) => void;
  onRemoveDay: (dayId: string) => void;
  onAddDay: () => void;
  onRenameDestination: (dayId: string, dest: string) => void;
}) {
  const totalBudget  = useMemo(() => days.reduce((s, d) => s + d.entities.reduce((es, e) => es + e.price, 0), 0), [days]);
  const totalItems   = days.reduce((s, d) => s + d.entities.length, 0);

  if (days.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}
      >
        <motion.div animate={{ y: [0, -10, 0], scale: [1, 1.08, 1] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, rgba(0,122,255,0.12), rgba(94,92,230,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={28} color="#5E5CE6" strokeWidth={1.6} />
        </motion.div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em', marginBottom: 5 }}>Canvas is empty</div>
          <div style={{ fontSize: 11.5, color: '#6E6E73', lineHeight: 1.6, maxWidth: 200, letterSpacing: '-0.01em' }}>Chat with AI or add days manually.</div>
        </div>
        <motion.button type="button" onClick={onAddDay} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 12, cursor: 'pointer', background: `linear-gradient(135deg, ${AZURE}, ${VIOLET})`, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: '0 4px 14px rgba(0,122,255,0.28)' }}
        >
          <Plus size={13} strokeWidth={2.5} />
          Add first day
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats + arc */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: 10 }}>
        {[
          { label: 'Days',   value: String(days.length),         color: AZURE  },
          { label: 'Items',  value: String(totalItems),          color: VIOLET },
          { label: 'Budget', value: `$${totalBudget.toLocaleString()}`, color: '#30D158' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, padding: '6px 9px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}16` }}>
            <div style={{ fontSize: 9, color: '#8E8E93', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em', marginTop: 1 }}>{value}</div>
          </div>
        ))}
        {/* Budget arc mini-chart */}
        <div style={{ padding: '4px 6px', borderRadius: 10, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 600, marginBottom: 2 }}>ARC</div>
          <BudgetArc days={days} />
        </div>
      </div>

      {/* Day list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, paddingRight: 2, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent', paddingBottom: 12 }}>
        <AnimatePresence mode="popLayout">
          {days.map(day => (
            <DreamDayCard key={day.id} day={day} isActive={activeDayId === day.id} onActivate={onActivate} onRemoveEntity={onRemoveEntity} onRemoveDay={onRemoveDay} onRenameDestination={onRenameDestination} />
          ))}
        </AnimatePresence>
        <motion.button type="button" onClick={onAddDay} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(0,122,255,0.05)', border: '1.5px dashed rgba(0,122,255,0.24)', fontSize: 11.5, fontWeight: 700, color: AZURE, transition: 'all 0.16s' }}
        >
          <Plus size={12} strokeWidth={2.5} />Add day
        </motion.button>
      </div>
    </div>
  );
}

// ── AIPanel ────────────────────────────────────────────────────────────────────

function AIPanel({
  onItineraryBuilt, activeSlotLabel,
}: {
  onItineraryBuilt: (state: Partial<{ title: string; days: DreamDay[] }>) => void;
  activeSlotLabel: SlotLabel;
}) {
  const [inputVal,      setInputVal]      = useState('');
  const [activeVibes,   setActiveVibes]   = useState<Set<VibeId>>(new Set());
  const [canRebuild,    setCanRebuild]    = useState(false);
  const [lastPrefs,     setLastPrefs]     = useState('');
  const messagesEndRef                    = useRef<HTMLDivElement>(null);
  const hasProcessed                      = useRef(new Set<string>());

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/dream' }),
  });
  const isLoading = status === 'streaming' || status === 'submitted';

  // Reset processed set when slot changes so rebuild works fresh
  useEffect(() => {
    hasProcessed.current.clear();
    setCanRebuild(false);
  }, [activeSlotLabel]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Parse JSON from completed AI messages
  useEffect(() => {
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAI || hasProcessed.current.has(lastAI.id) || isLoading) return;
    const text = msgText(lastAI.parts as Array<{ type: string; text?: string }>);
    if (text.includes('</DREAM_ITINERARY>')) {
      hasProcessed.current.add(lastAI.id);
      const parsed = parseDreamJSON(text);
      if (parsed?.days?.length) {
        setTimeout(() => {
          onItineraryBuilt(parsed);
          setCanRebuild(true);
        }, 300);
      }
    }
  }, [messages, isLoading, onItineraryBuilt]);

  const toggleVibe = useCallback((id: VibeId) => {
    setActiveVibes(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const buildPrompt = useCallback((raw: string) => {
    const vibeStr = activeVibes.size > 0
      ? `[VIBES: ${[...activeVibes].map(v => VIBES.find(vb => vb.id === v)?.label).join(', ')}] `
      : '';
    return vibeStr + raw;
  }, [activeVibes]);

  const send = useCallback(() => {
    const t = inputVal.trim();
    if (!t || isLoading) return;
    const prompt = buildPrompt(t);
    setLastPrefs(prompt);
    sendMessage({ text: prompt });
    setInputVal('');
  }, [inputVal, isLoading, buildPrompt, sendMessage]);

  const rebuild = useCallback(() => {
    if (!lastPrefs || isLoading) return;
    const rebuildMsg = `Rebuild this dream itinerary — keeping my preferences (${lastPrefs}) — but make it fresh with different specific hotels, restaurants, and activities. Same vibe, new picks.`;
    sendMessage({ text: rebuildMsg });
  }, [lastPrefs, isLoading, sendMessage]);

  const CHIPS = [
    'Honeymoon in Santorini, 7 days, luxury, $8K',
    'Backpacking SEA 14 days, $2,500',
    'Paris & Tuscany 10 days, culture + food',
    'Tokyo food & tech adventure 6 days',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: `linear-gradient(135deg, ${AZURE}, ${VIOLET})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,122,255,0.28)' }}>
            <Sparkles size={12} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.022em' }}>Dream Architect AI</div>
            <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 0.5 }}>Slot {activeSlotLabel} · Describe your dream, I'll build the full itinerary</div>
          </div>
        </div>

        {/* ── VIBE SEEDS ── */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Vibe seeds</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {VIBES.map(vibe => {
              const active = activeVibes.has(vibe.id);
              return (
                <motion.button key={vibe.id} type="button" onClick={() => toggleVibe(vibe.id)}
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  animate={{
                    background: active ? `${vibe.color}18` : 'rgba(0,0,0,0.04)',
                    borderColor: active ? `${vibe.color}40` : 'transparent',
                    boxShadow: active ? `0 0 12px ${vibe.color}28, inset 0 0 6px ${vibe.color}08` : 'none',
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 9px', borderRadius: 100, cursor: 'pointer',
                    fontFamily: 'inherit', border: '1.5px solid transparent', fontSize: 10.5,
                    fontWeight: active ? 700 : 500, color: active ? vibe.color : '#6E6E73',
                    transition: 'color 0.15s',
                  }}
                >
                  {(() => { const VI = vibe.icon; return <VI size={11} color={active ? vibe.color : '#6E6E73'} strokeWidth={active ? 2.5 : 2} />; })()}
                  {vibe.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Quick chips when no messages */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {CHIPS.map(chip => (
              <motion.button key={chip} type="button" onClick={() => { sendMessage({ text: buildPrompt(chip) }); setLastPrefs(buildPrompt(chip)); }}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '3px 9px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600, color: AZURE, background: `${AZURE}08`, border: `1px solid ${AZURE}20`, transition: 'all 0.15s' }}
              >
                {chip}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent', paddingBottom: 6 }}>
        <AnimatePresence initial={false}>
          {messages.map(msg => {
            const raw         = msgText(msg.parts as Array<{ type: string; text?: string }>);
            const isUser      = msg.role === 'user';
            const displayText = isUser ? raw : narrativeOnly(raw);
            const hasDream    = !isUser && raw.includes('</DREAM_ITINERARY>');

            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}
              >
                <div style={{
                  maxWidth: '92%', padding: '9px 13px',
                  borderRadius: isUser ? '13px 13px 4px 13px' : '13px 13px 13px 4px',
                  background: isUser ? `linear-gradient(135deg, ${AZURE}, ${VIOLET})` : 'rgba(255,255,255,0.92)',
                  border: isUser ? 'none' : '1px solid rgba(0,0,0,0.07)',
                  boxShadow: isUser ? '0 3px 12px rgba(0,122,255,0.22)' : '0 2px 9px rgba(0,0,0,0.05)',
                  color: isUser ? '#fff' : '#1D1D1F',
                  fontSize: 12, fontWeight: 400, lineHeight: 1.6, letterSpacing: '-0.005em',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {displayText}
                  {!isUser && !displayText && isLoading && (
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity }} style={{ display: 'inline-block', marginLeft: 2 }}>▋</motion.span>
                  )}
                </div>
                {hasDream && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, ...SPRING }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 100, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.26)', fontSize: 10, fontWeight: 700, color: '#30D158', marginTop: 5 }}
                  >
                    <CheckCircle2 size={10} strokeWidth={2.5} />
                    Dream built — canvas updated
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 13px', borderRadius: '13px 13px 13px 4px', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.07)' }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.18 }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: AZURE }} />
              ))}
              <span style={{ fontSize: 11, color: '#6E6E73', marginLeft: 2 }}>Building your dream…</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input + controls */}
      <div style={{ flexShrink: 0, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        {/* Rebuild + clear buttons */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
            {canRebuild && (
              <motion.button type="button" onClick={rebuild} disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.03 } : {}} whileTap={!isLoading ? { scale: 0.97 } : {}}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 9, cursor: isLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit', border: `1px solid ${VIOLET}30`, background: `${VIOLET}09`,
                  fontSize: 10.5, fontWeight: 700, color: VIOLET, transition: 'all 0.15s',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <Zap size={10} strokeWidth={2.5} />
                Rebuild (keep vibes)
              </motion.button>
            )}
            <motion.button type="button" onClick={() => { setMessages([]); hasProcessed.current.clear(); setCanRebuild(false); }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(0,0,0,0.05)', fontSize: 10.5, fontWeight: 600, color: '#6E6E73' }}
            >
              <RotateCcw size={10} strokeWidth={2.5} />
              New dream
            </motion.button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, padding: '9px 12px', borderRadius: 13, background: 'rgba(248,248,252,0.92)', border: '1.5px solid rgba(0,0,0,0.07)' }}>
          <textarea
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={activeVibes.size > 0 ? `${[...activeVibes].map(v => VIBES.find(vb => vb.id === v)?.label).join(' + ')} trip — describe it…` : 'Describe your dream trip…'}
            rows={2}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 500, color: '#1D1D1F', fontFamily: 'inherit', letterSpacing: '-0.01em', resize: 'none', lineHeight: 1.5, scrollbarWidth: 'none' }}
          />
          {isLoading ? (
            <motion.button type="button" onClick={stop} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, border: 'none', background: 'rgba(255,69,58,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={12} color="#FF453A" strokeWidth={2.5} />
            </motion.button>
          ) : (
            <motion.button type="button" onClick={send} disabled={!inputVal.trim()}
              whileHover={inputVal.trim() ? { scale: 1.08 } : {}}
              whileTap={inputVal.trim() ? { scale: 0.92 } : {}}
              style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, border: 'none', background: inputVal.trim() ? `linear-gradient(135deg, ${AZURE}, ${VIOLET})` : 'rgba(0,0,0,0.08)', cursor: inputVal.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: inputVal.trim() ? '0 3px 10px rgba(0,122,255,0.28)' : 'none', transition: 'all 0.18s' }}
            >
              <Send size={12} color={inputVal.trim() ? '#fff' : '#AEAEB2'} strokeWidth={2} />
            </motion.button>
          )}
        </div>
        <div style={{ fontSize: 9, color: '#AEAEB2', marginTop: 4, textAlign: 'center' }}>↵ Send · Shift+↵ New line · Nothing commits until you import</div>
      </div>
    </div>
  );
}

// ── ManualPanel ────────────────────────────────────────────────────────────────

interface FormState {
  category: Category; title: string; subtitle: string; price: string; time: string; duration: string;
  from: string; to: string; cabin: string; airline: string;
  nights: string; roomType: string; stars: string;
  cuisine: string; michelinStar: string;
  activityType: string; difficulty: string;
  mode: string;
}
const EMPTY_FORM: FormState = {
  category: 'flight', title: '', subtitle: '', price: '', time: '', duration: '',
  from: '', to: '', cabin: 'Economy', airline: '',
  nights: '1', roomType: 'Standard', stars: '4',
  cuisine: '', michelinStar: '',
  activityType: 'Cultural', difficulty: 'easy',
  mode: 'Train',
};

function ManualPanel({
  days, activeDayId, onAddEntity, onSetActiveDay,
}: {
  days: DreamDay[]; activeDayId: string | null;
  onAddEntity: (dayId: string, entity: Omit<DreamEntity, 'id'>) => void;
  onSetActiveDay: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const update = useCallback((k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v })), []);
  const selectedDay = days.find(d => d.id === activeDayId) ?? days[0] ?? null;

  const buildEntity = (): Omit<DreamEntity, 'id'> | null => {
    if (!form.title.trim()) return null;
    let subtitle = form.subtitle.trim();
    let details: Record<string, string | number | boolean> = {};
    switch (form.category) {
      case 'flight':     subtitle = subtitle || `${form.from} → ${form.to} · ${form.cabin}`; details = { from: form.from, to: form.to, cabin: form.cabin, airline: form.airline }; break;
      case 'hotel':      subtitle = subtitle || `${form.roomType} · ${form.nights}n`; details = { nights: parseInt(form.nights)||1, roomType: form.roomType, stars: parseInt(form.stars) }; break;
      case 'restaurant': subtitle = subtitle || `${form.cuisine}${form.michelinStar ? ` · ${form.michelinStar}★` : ''}`; details = { cuisine: form.cuisine, stars: form.michelinStar }; break;
      case 'activity':   subtitle = subtitle || `${form.activityType} · ${form.difficulty}`; details = { type: form.activityType, difficulty: form.difficulty }; break;
      case 'transport':  subtitle = subtitle || `${form.mode} · ${form.from} → ${form.to}`; details = { mode: form.mode, from: form.from, to: form.to }; break;
    }
    return { category: form.category, title: form.title.trim(), subtitle, price: parseFloat(form.price)||0, time: form.time||undefined, duration: form.duration||undefined, details };
  };

  const handleAdd = () => {
    if (!selectedDay) return;
    const e = buildEntity(); if (!e) return;
    onAddEntity(selectedDay.id, e);
    setForm(p => ({ ...EMPTY_FORM, category: p.category }));
  };

  const field: React.CSSProperties = { width: '100%', padding: '7px 10px', boxSizing: 'border-box', borderRadius: 9, border: '1.5px solid rgba(0,0,0,0.09)', background: 'rgba(0,0,0,0.03)', fontSize: 11.5, fontFamily: 'inherit', color: '#1D1D1F', outline: 'none', fontWeight: 500 };
  const label: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, color: '#6E6E73', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3, display: 'block' };
  const CATEGORIES = Object.keys(CAT_CONFIG) as Category[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', scrollbarWidth: 'none', height: '100%' }}>
      {/* Day selector */}
      <div>
        <span style={label}>Add to day</span>
        {days.length === 0 ? (
          <div style={{ fontSize: 11, color: '#FF9F0A', padding: '7px 11px', borderRadius: 9, background: 'rgba(255,159,10,0.07)', border: '1px solid rgba(255,159,10,0.22)' }}>Add a day to the canvas first ←</div>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {days.map(d => {
              const col = dayColor(d.dayNumber);
              const sel = selectedDay?.id === d.id;
              return (
                <motion.button key={d.id} type="button" onClick={() => onSetActiveDay(d.id)} whileTap={{ scale: 0.95 }}
                  style={{ padding: '4px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: sel ? 800 : 600, background: sel ? `${col}14` : 'rgba(0,0,0,0.04)', border: `1.5px solid ${sel ? col + '38' : 'transparent'}`, color: sel ? col : '#6E6E73', transition: 'all 0.16s' }}
                >
                  {d.dayNumber} · {d.destination.slice(0, 10)}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Category */}
      <div>
        <span style={label}>Category</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {CATEGORIES.map(cat => {
            const cfg = CAT_CONFIG[cat]; const Icon = cfg.icon; const sel = form.category === cat;
            return (
              <motion.button key={cat} type="button" onClick={() => update('category', cat)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 4px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', background: sel ? cfg.bg : 'rgba(0,0,0,0.03)', border: `1.5px solid ${sel ? cfg.color + '40' : 'transparent'}`, boxShadow: sel ? `0 0 10px ${cfg.color}18` : 'none', transition: 'all 0.16s' }}
              >
                <Icon size={13} color={sel ? cfg.color : '#8E8E93'} strokeWidth={sel ? 2.2 : 2} />
                <span style={{ fontSize: 9, fontWeight: sel ? 700 : 500, color: sel ? cfg.color : '#8E8E93' }}>{cfg.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <span style={label}>Name *</span>
        <input value={form.title} onChange={e => update('title', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={form.category === 'flight' ? 'e.g. Air France AF 1234' : form.category === 'hotel' ? 'e.g. Ritz Paris' : form.category === 'restaurant' ? 'e.g. Noma Copenhagen' : form.category === 'activity' ? 'e.g. Louvre Museum' : 'e.g. TGV Paris → Lyon'}
          style={field}
        />
      </div>

      {/* Category-specific */}
      <AnimatePresence mode="wait">
        <motion.div key={form.category} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.category === 'flight' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div><span style={label}>From</span><input value={form.from} onChange={e => update('from', e.target.value)} placeholder="TLV" style={field} /></div>
              <div><span style={label}>To</span><input value={form.to} onChange={e => update('to', e.target.value)} placeholder="CDG" style={field} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div><span style={label}>Airline</span><input value={form.airline} onChange={e => update('airline', e.target.value)} placeholder="Air France" style={field} /></div>
              <div><span style={label}>Cabin</span><select value={form.cabin} onChange={e => update('cabin', e.target.value)} style={{ ...field, cursor: 'pointer' }}>{['Economy','Premium Economy','Business','First'].map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
          </>)}
          {form.category === 'hotel' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div><span style={label}>Nights</span><input type="number" min="1" value={form.nights} onChange={e => update('nights', e.target.value)} style={field} /></div>
              <div><span style={label}>Stars</span><select value={form.stars} onChange={e => update('stars', e.target.value)} style={{ ...field, cursor: 'pointer' }}>{['2','3','4','5'].map(s => <option key={s}>{s}★</option>)}</select></div>
            </div>
            <div><span style={label}>Room type</span><select value={form.roomType} onChange={e => update('roomType', e.target.value)} style={{ ...field, cursor: 'pointer' }}>{['Standard','Superior','Deluxe','Junior Suite','Suite','Villa','Presidential'].map(r => <option key={r}>{r}</option>)}</select></div>
          </>)}
          {form.category === 'restaurant' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div><span style={label}>Cuisine</span><input value={form.cuisine} onChange={e => update('cuisine', e.target.value)} placeholder="French" style={field} /></div>
              <div><span style={label}>Michelin</span><select value={form.michelinStar} onChange={e => update('michelinStar', e.target.value)} style={{ ...field, cursor: 'pointer' }}><option value="">None</option><option value="1">1★</option><option value="2">2★★</option><option value="3">3★★★</option></select></div>
            </div>
          )}
          {form.category === 'activity' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div><span style={label}>Type</span><select value={form.activityType} onChange={e => update('activityType', e.target.value)} style={{ ...field, cursor: 'pointer' }}>{['Cultural','Outdoor','Adventure','Wellness','Culinary','Nightlife'].map(t => <option key={t}>{t}</option>)}</select></div>
              <div><span style={label}>Effort</span><select value={form.difficulty} onChange={e => update('difficulty', e.target.value)} style={{ ...field, cursor: 'pointer' }}>{['easy','moderate','challenging'].map(d => <option key={d}>{d}</option>)}</select></div>
            </div>
          )}
          {form.category === 'transport' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div><span style={label}>Mode</span><select value={form.mode} onChange={e => update('mode', e.target.value)} style={{ ...field, cursor: 'pointer' }}>{['Train','Bus','Uber','Taxi','Rental Car','Ferry','Metro','Tuk-tuk'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div><span style={label}>From → To</span><input value={form.from} onChange={e => update('from', e.target.value)} placeholder="A → B" style={field} /></div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Time / Duration / Price */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
        <div><span style={label}>Time</span><input type="time" value={form.time} onChange={e => update('time', e.target.value)} style={field} /></div>
        <div><span style={label}>Duration</span><input value={form.duration} onChange={e => update('duration', e.target.value)} placeholder="2h 30m" style={field} /></div>
        <div><span style={label}>Price ($)</span><input type="number" min="0" value={form.price} onChange={e => update('price', e.target.value)} placeholder="0" style={field} /></div>
      </div>

      <motion.button type="button" onClick={handleAdd} disabled={!form.title.trim() || !selectedDay}
        whileHover={form.title.trim() && selectedDay ? { scale: 1.02, y: -1 } : {}}
        whileTap={form.title.trim() && selectedDay ? { scale: 0.98 } : {}}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '11px', borderRadius: 13, cursor: form.title.trim() && selectedDay ? 'pointer' : 'default',
          background: form.title.trim() && selectedDay ? `linear-gradient(135deg, ${CAT_CONFIG[form.category].color}, ${VIOLET})` : 'rgba(0,0,0,0.07)',
          border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800,
          color: form.title.trim() && selectedDay ? '#fff' : '#AEAEB2',
          boxShadow: form.title.trim() && selectedDay ? `0 4px 14px ${CAT_CONFIG[form.category].color}38` : 'none',
          transition: 'all 0.18s', marginTop: 4,
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
        Add {CAT_CONFIG[form.category].label}
        {selectedDay && ` · Day ${selectedDay.dayNumber}`}
      </motion.button>
      <div style={{ height: 12 }} />
    </div>
  );
}

// ── ImportModal ────────────────────────────────────────────────────────────────

function ImportModal({
  dreamDays, realDays, onConfirm, onClose,
}: {
  dreamDays: DreamDay[];
  realDays: Array<{ id: string; dayNumber: number; destination: string }>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const total = dreamDays.reduce((s, d) => s + d.entities.length, 0);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.92, y: 20, opacity: 0 }} transition={SPRING}
        onClick={e => e.stopPropagation()}
        style={{ width: 380, maxHeight: '80vh', overflowY: 'auto', borderRadius: 24, padding: 24, background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(255,255,255,0.99)', boxShadow: '0 28px 80px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,1)', scrollbarWidth: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${AZURE}, ${VIOLET})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,122,255,0.28)' }}>
              <ArrowRight size={15} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>Import Dream to Trip</div>
              <div style={{ fontSize: 10.5, color: '#6E6E73', marginTop: 1 }}>{total} item{total !== 1 ? 's' : ''} · {dreamDays.length} day{dreamDays.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <motion.button type="button" whileHover={{ scale: 1.1, background: 'rgba(0,0,0,0.10)' }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={12} color="#6E6E73" strokeWidth={2.5} />
          </motion.button>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 12, marginBottom: 16, background: `${AZURE}07`, border: `1px solid ${AZURE}16`, fontSize: 11, color: '#3C3C43', lineHeight: 1.55 }}>
          {realDays.length > 0 ? 'Dream Day 1 → Real Day 1, and so on. Extra dream days go to Day 1.' : '⚠️ Set up your trip first at /setup — dream items land there.'}
        </div>

        {dreamDays.slice(0, 5).map(dd => {
          const real = realDays.find(r => r.dayNumber === dd.dayNumber) ?? realDays[0];
          const col  = dayColor(dd.dayNumber);
          return (
            <div key={dd.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 10, background: `${col}08`, border: `1px solid ${col}18`, marginBottom: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{dd.dayNumber}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F', flex: 1 }}>{dd.destination} <span style={{ color: '#AEAEB2', fontWeight: 500 }}>({dd.entities.length} items)</span></div>
              <ArrowRight size={10} color="#AEAEB2" strokeWidth={2} />
              <div style={{ fontSize: 10.5, fontWeight: 700, color: AZURE }}>{real ? `Day ${real.dayNumber}` : 'Day 1'}</div>
            </div>
          );
        })}
        {dreamDays.length > 5 && <div style={{ fontSize: 10, color: '#AEAEB2', textAlign: 'center', marginBottom: 6 }}>+ {dreamDays.length - 5} more days…</div>}

        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <motion.button type="button" onClick={onClose} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer', background: 'rgba(0,0,0,0.05)', border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#6E6E73' }}
          >Cancel</motion.button>
          <motion.button type="button" onClick={onConfirm} whileHover={{ scale: 1.02, boxShadow: `0 8px 28px ${AZURE}40` }} whileTap={{ scale: 0.98 }}
            style={{ flex: 2, padding: '10px', borderRadius: 12, cursor: 'pointer', background: `linear-gradient(135deg, ${AZURE}, ${VIOLET})`, border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, color: '#fff', boxShadow: `0 4px 14px ${AZURE}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ArrowRight size={13} strokeWidth={2.5} />Import to Real Trip
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── DreamZone (main export) ────────────────────────────────────────────────────

export function DreamZone() {
  // ── Multi-slot state ───────────────────────────────────────────────────────
  const [slots,        setSlots]        = useState<Record<SlotLabel, DreamSlot>>({
    A: emptySlot('A'), B: emptySlot('B'), C: emptySlot('C'),
  });
  const [activeSlot,   setActiveSlot]   = useState<SlotLabel>('A');
  const [mode,         setMode]         = useState<'ai' | 'manual'>('ai');
  const [activeDayId,  setActiveDayId]  = useState<string | null>(null);
  const [showImport,   setShowImport]   = useState(false);
  const [justImported, setJustImported] = useState(false);

  const realDays    = useTravelEngine(s => s.days);
  const placeEntity = useTravelEngine(s => s.placeEntity);
  const { success: toastSuccess, info: toastInfo } = useToast();

  // Computed from active slot
  const slot = slots[activeSlot];
  const days = slot.days;
  const totalBudget = useMemo(() => days.reduce((s, d) => s + d.entities.reduce((es, e) => es + e.price, 0), 0), [days]);

  // ── Persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<SlotLabel, DreamSlot>;
      setSlots(s);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch {}
  }, [slots]);

  // ── Slot helpers ──────────────────────────────────────────────────────────

  const updateSlot = useCallback((label: SlotLabel, patch: Partial<DreamSlot>) => {
    setSlots(prev => ({ ...prev, [label]: { ...prev[label], ...patch, savedAt: Date.now() } }));
  }, []);

  const patchDays = useCallback((fn: (prev: DreamDay[]) => DreamDay[]) => {
    setSlots(prev => ({ ...prev, [activeSlot]: { ...prev[activeSlot], days: fn(prev[activeSlot].days), savedAt: Date.now() } }));
  }, [activeSlot]);

  // ── Canvas handlers ───────────────────────────────────────────────────────

  const addDay = useCallback(() => {
    const dayNumber = (days[days.length - 1]?.dayNumber ?? 0) + 1;
    const newDay: DreamDay = { id: uid(), dayNumber, date: '', destination: `Day ${dayNumber}`, entities: [] };
    patchDays(prev => [...prev, newDay]);
    setActiveDayId(newDay.id);
  }, [days, patchDays]);

  const removeDay = useCallback((dayId: string) => {
    patchDays(prev => prev.filter(d => d.id !== dayId));
    setActiveDayId(prev => prev === dayId ? null : prev);
  }, [patchDays]);

  const addEntity = useCallback((dayId: string, entity: Omit<DreamEntity, 'id'>) => {
    patchDays(prev => prev.map(d => d.id === dayId ? { ...d, entities: [...d.entities, { ...entity, id: uid() }] } : d));
    setActiveDayId(dayId);
  }, [patchDays]);

  const removeEntity = useCallback((dayId: string, entityId: string) => {
    patchDays(prev => prev.map(d => d.id === dayId ? { ...d, entities: d.entities.filter(e => e.id !== entityId) } : d));
  }, [patchDays]);

  const renameDestination = useCallback((dayId: string, dest: string) => {
    patchDays(prev => prev.map(d => d.id === dayId ? { ...d, destination: dest } : d));
  }, [patchDays]);

  const clearSlot = useCallback(() => {
    updateSlot(activeSlot, { days: [], title: '' });
    setActiveDayId(null);
  }, [activeSlot, updateSlot]);

  const onItineraryBuilt = useCallback((state: Partial<{ title: string; days: DreamDay[] }>) => {
    if (!state.days?.length) return;
    updateSlot(activeSlot, { title: state.title ?? '', days: state.days });
    setActiveDayId(state.days[0]?.id ?? null);
    toastSuccess(`Slot ${activeSlot} — ${state.days.length} days built`);
  }, [activeSlot, updateSlot, toastSuccess]);

  const handleImportConfirm = useCallback(() => {
    let imported = 0;
    days.forEach(dreamDay => {
      const realDay = realDays.find(rd => rd.dayNumber === dreamDay.dayNumber) ?? realDays[0];
      if (!realDay) return;
      dreamDay.entities.forEach(entity => {
        const cat = CAT_CONFIG[entity.category];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const source: any = {
          id: entity.id, category: entity.category,
          sources: ['dream-zone'], sourceCount: 1, aiConfidence: 0.95,
          tags: [entity.category, 'dream'],
        };
        if (entity.category === 'flight') {
          Object.assign(source, { airline: entity.title, flightNumber: '', route: entity.subtitle, origin: String(entity.details.from ?? ''), destination: String(entity.details.to ?? ''), departure: entity.time ?? '08:00', arrival: '', durationMin: 240, durationLabel: entity.duration ?? '', stops: 0, class: 'Economy', price: entity.price, priceRange: [entity.price * 0.9, entity.price * 1.1], carbonKg: 300, carbonLabel: '', carbonAlternative: '', priceDropProbability: 0, seats: 2, refundable: true });
        } else if (entity.category === 'hotel') {
          Object.assign(source, { name: entity.title, location: realDay.destination, destination: realDay.destination, tier: `${entity.details.stars ?? 4}★`, roomType: String(entity.details.roomType ?? 'Standard'), pricePerNight: Math.round(entity.price / (Number(entity.details.nights) || 1)), totalPrice: entity.price, nights: Number(entity.details.nights || 1), rating: 4.5, reviewCount: 500, sentiment: { positive: 0.88, neutral: 0.09, negative: 0.03, compound: 0.85 }, amenities: [], aiHighlight: entity.subtitle });
        } else if (entity.category === 'restaurant') {
          Object.assign(source, { name: entity.title, cuisine: String(entity.details.cuisine ?? 'International'), location: realDay.destination, destination: realDay.destination, pricePerPerson: Math.round(entity.price / 2), rating: 4.6, sentiment: { positive: 0.90, neutral: 0.07, negative: 0.03, compound: 0.87 }, reservationWindow: '1 week', uberMinutes: 15, uberCost: 12, aiHighlight: entity.subtitle });
        } else {
          Object.assign(source, { title: entity.title, description: entity.subtitle, type: 'cultural', destination: realDay.destination, city: realDay.destination, durationHours: 2, groupSizeMax: 10, pricePerPerson: entity.price, difficulty: 'easy', weatherDependency: 'low', bestTimeOfDay: 'morning', instantBook: false, rating: 4.5, reviewCount: 200, aiHighlight: entity.subtitle, weatherMatch: null, gradient: cat.bg, providers: ['dream'] });
        }
        placeEntity(realDay.id, source);
        imported++;
      });
    });
    setShowImport(false);
    setJustImported(true);
    setTimeout(() => setJustImported(false), 4000);
    toastSuccess(`✈ ${imported} dream item${imported !== 1 ? 's' : ''} imported!`);
  }, [days, realDays, placeEntity, toastSuccess]);

  // Copy slot
  const copySlot = useCallback((from: SlotLabel, to: SlotLabel) => {
    updateSlot(to, { title: slots[from].title + ' (copy)', days: JSON.parse(JSON.stringify(slots[from].days)) });
    setActiveSlot(to);
    toastSuccess(`Slot ${from} copied to slot ${to}`);
  }, [slots, updateSlot, toastSuccess]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── SLOT TABS (innovation #1: parallel dream slots) ─────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0,
        padding: '10px 16px 0',
        background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        {SLOT_LABELS.map(label => {
          const col   = SLOT_COLORS[label];
          const s     = slots[label];
          const items = s.days.reduce((n, d) => n + d.entities.length, 0);
          const bgt   = s.days.reduce((n, d) => n + d.entities.reduce((e, en) => e + en.price, 0), 0);
          const active = activeSlot === label;
          return (
            <motion.button key={label} type="button"
              onClick={() => setActiveSlot(label)}
              whileHover={!active ? { backgroundColor: `${col}08` } : {}}
              whileTap={{ scale: 0.97 }}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column',
                padding: '7px 16px 9px', cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', border: 'none', borderRadius: '10px 10px 0 0',
                minWidth: 100, transition: 'background 0.15s',
              }}
            >
              {active && (
                <motion.div layoutId="slot-indicator"
                  style={{ position: 'absolute', bottom: 0, left: 6, right: 6, height: 2.5, background: col, borderRadius: '3px 3px 0 0' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 18, borderRadius: 6, background: active ? col : `${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: active ? '#fff' : col, transition: 'all 0.2s' }}>
                  {label}
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? '#1D1D1F' : '#8E8E93', letterSpacing: '-0.01em', transition: 'color 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70 }}>
                  {s.title || `Slot ${label}`}
                </span>
              </div>
              {s.days.length > 0 && (
                <div style={{ fontSize: 9, color: active ? col : '#AEAEB2', marginTop: 2, fontWeight: 600 }}>
                  {s.days.length}d · {items} items{bgt > 0 ? ` · $${(bgt / 1000).toFixed(1)}K` : ''}
                </div>
              )}
            </motion.button>
          );
        })}

        {/* Slot copy button */}
        {days.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, paddingBottom: 6 }}>
            {SLOT_LABELS.filter(l => l !== activeSlot).map(l => (
              <motion.button key={l} type="button"
                onClick={() => copySlot(activeSlot, l)}
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                title={`Copy to Slot ${l}`}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(0,0,0,0.05)', fontSize: 10, fontWeight: 700, color: '#6E6E73' }}
              >
                <Copy size={9} strokeWidth={2.5} />
                → {l}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* ── Zone header ──────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `linear-gradient(135deg, ${AZURE}, ${VIOLET})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,122,255,0.25)' }}>
          <Sparkles size={13} color="#fff" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.028em' }}>Dream Zone</div>
          <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 0.5 }}>Sandbox · nothing commits until you import</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, background: 'rgba(0,0,0,0.055)', borderRadius: 9, padding: '2.5px', flexShrink: 0 }}>
          {([{ id: 'ai', icon: Sparkles, label: 'AI Build' }, { id: 'manual', icon: Hammer, label: 'Manual' }] as const).map(({ id, icon: Icon, label }) => {
            const active = mode === id;
            return (
              <motion.button key={id} type="button" onClick={() => setMode(id)} whileTap={{ scale: 0.95 }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', border: 'none', position: 'relative', background: 'transparent', fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? (id === 'ai' ? AZURE : VIOLET) : '#8E8E93', transition: 'color 0.15s' }}
              >
                {active && <motion.div layoutId="dream-mode-pill" style={{ position: 'absolute', inset: 0, borderRadius: 7, background: 'rgba(255,255,255,0.98)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}><Icon size={11} strokeWidth={active ? 2.4 : 2} /></span>
                <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {days.length > 0 && (
            <motion.button type="button" onClick={clearSlot} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(255,69,58,0.07)', fontSize: 10, fontWeight: 700, color: '#FF453A' }}
            >
              <RotateCcw size={10} strokeWidth={2.5} />Clear
            </motion.button>
          )}
          <motion.button type="button"
            onClick={() => days.length ? setShowImport(true) : toastInfo('Add items to your dream first')}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: justImported ? 'rgba(48,209,88,0.12)' : days.length ? `linear-gradient(135deg, ${AZURE}, ${VIOLET})` : 'rgba(0,0,0,0.08)',
              fontSize: 11, fontWeight: 800, color: justImported ? '#30D158' : days.length ? '#fff' : '#AEAEB2',
              boxShadow: days.length && !justImported ? `0 3px 12px ${AZURE}28` : 'none', transition: 'all 0.18s',
            }}
          >
            {justImported ? <><CheckCircle2 size={11} strokeWidth={2.5} />Imported!</> : <><ArrowRight size={11} strokeWidth={2.5} />Import</>}
          </motion.button>
        </div>
      </div>

      {/* ── Split layout ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Dream Canvas */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: 0.06 }}
          style={{ width: 310, flexShrink: 0, borderRight: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', padding: '11px 13px', background: 'rgba(255,255,255,0.40)', backdropFilter: 'blur(20px)', overflowY: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={11} color="#6E6E73" strokeWidth={2} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Canvas · Slot {activeSlot}</span>
            </div>
            {totalBudget > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 100, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.20)' }}>
                <DollarSign size={8} color="#30D158" strokeWidth={2.5} />
                <span style={{ fontSize: 9, fontWeight: 800, color: '#30D158' }}>{(totalBudget / 1000).toFixed(1)}K</span>
              </div>
            )}
          </div>

          <DreamCanvas days={days} activeDayId={activeDayId} onActivate={setActiveDayId} onRemoveEntity={removeEntity} onRemoveDay={removeDay} onAddDay={addDay} onRenameDestination={renameDestination} />
        </motion.div>

        {/* Right: AI or Manual */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: 0.10 }}
          style={{ flex: 1, minWidth: 0, padding: '13px 15px', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}
        >
          <AnimatePresence mode="wait">
            {mode === 'ai' ? (
              <motion.div key={`ai-${activeSlot}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} style={{ height: '100%' }}>
                <AIPanel onItineraryBuilt={onItineraryBuilt} activeSlotLabel={activeSlot} />
              </motion.div>
            ) : (
              <motion.div key={`manual-${activeSlot}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} style={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'none' }}>
                <ManualPanel days={days} activeDayId={activeDayId} onAddEntity={addEntity} onSetActiveDay={setActiveDayId} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Import modal */}
      <AnimatePresence>
        {showImport && <ImportModal dreamDays={days} realDays={realDays} onConfirm={handleImportConfirm} onClose={() => setShowImport(false)} />}
      </AnimatePresence>
    </div>
  );
}
