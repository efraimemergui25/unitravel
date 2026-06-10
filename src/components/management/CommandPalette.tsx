'use client';

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { motion, AnimatePresence }   from 'framer-motion';
import { useRouter }                 from 'next/navigation';
import { useTravelEngine }           from '@/store/useTravelEngine';
import {
  Search, CalendarDays, Wallet, Map, Plane, Hotel,
  UtensilsCrossed, Compass, Train, Plus, CheckSquare,
  Zap, Download, Share2, RefreshCw, ArrowRight,
  Clock3, Target, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type CommandGroup = 'navigate' | 'action' | 'day' | 'filter';

interface Command {
  id:       string;
  label:    string;
  sub?:     string;
  icon:     React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color:    string;
  group:    CommandGroup;
  kbd?:     string;
  action:   () => void;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';
const VIOLET  = '#5E5CE6';
const RED     = '#FF453A';

const SPRING = { type: 'spring', stiffness: 480, damping: 28 } as const;

// ── CommandPalette ─────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  onClose:    () => void;
  onAddExpense?: () => void;
  onTabSwitch?: (tab: string) => void;
}

export function CommandPalette({ onClose, onAddExpense, onTabSwitch }: CommandPaletteProps) {
  const [query,     setQuery]     = useState('');
  const [selected,  setSelected]  = useState(0);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const listRef                   = useRef<HTMLDivElement>(null);
  const router                    = useRouter();

  const days         = useTravelEngine(s => s.days);
  const trip         = useTravelEngine(s => s.trip);
  const setActiveDay = useTravelEngine(s => s.setActiveDay);
  const budget       = useTravelEngine(s => s.budget);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Build command list
  const allCommands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      // ── Navigation ────────────────────────────────────────────────────────
      { id: 'nav-timeline',  label: 'Open Timeline',   sub: 'View your itinerary',   icon: CalendarDays,     color: AZURE,   group: 'navigate', kbd: '1', action: () => { onTabSwitch?.('timeline');  onClose(); } },
      { id: 'nav-budget',    label: 'Open Budget',     sub: 'Track expenses',         icon: Wallet,           color: EMERALD, group: 'navigate', kbd: '2', action: () => { onTabSwitch?.('budget');    onClose(); } },
      { id: 'nav-calendar',  label: 'Open Calendar',   sub: 'Month view',             icon: CalendarDays,     color: VIOLET,  group: 'navigate', kbd: '3', action: () => { onTabSwitch?.('calendar');  onClose(); } },
      { id: 'nav-checklist', label: 'Open Checklist',  sub: 'Pre-trip tasks',         icon: CheckSquare,      color: VIOLET,  group: 'navigate', kbd: '4', action: () => { onTabSwitch?.('checklist'); onClose(); } },
      { id: 'nav-schedule',  label: 'Open Schedule',   sub: 'Day-by-day agenda',      icon: Clock3,           color: AMBER,   group: 'navigate', kbd: '5', action: () => { onTabSwitch?.('schedule');  onClose(); } },
      { id: 'nav-flights',   label: 'Search Flights',  sub: 'Plan zone',              icon: Plane,            color: AZURE,   group: 'navigate', action: () => { router.push('/zone/flights');     onClose(); } },
      { id: 'nav-stays',     label: 'Search Stays',    sub: 'Plan zone',              icon: Hotel,            color: VIOLET,  group: 'navigate', action: () => { router.push('/zone/lodging');     onClose(); } },
      { id: 'nav-dining',    label: 'Search Dining',   sub: 'Plan zone',              icon: UtensilsCrossed,  color: AMBER,   group: 'navigate', action: () => { router.push('/zone/dining');      onClose(); } },
      { id: 'nav-xp',        label: 'Search Experiences', sub: 'Plan zone',           icon: Compass,          color: EMERALD, group: 'navigate', action: () => { router.push('/zone/attractions'); onClose(); } },
      { id: 'nav-map',       label: 'Open Map',        sub: 'Visual overview',        icon: Map,              color: '#00C7BE', group: 'navigate', action: () => { router.push('/zone/map');       onClose(); } },

      // ── Actions ────────────────────────────────────────────────────────────
      { id: 'act-expense',   label: 'Add Expense',     sub: 'Log a manual spend',     icon: Plus,             color: EMERALD, group: 'action',   kbd: 'E', action: () => { onAddExpense?.(); onClose(); } },
      { id: 'act-export',    label: 'Export Calendar', sub: 'Download .ics file',     icon: Download,         color: VIOLET,  group: 'action',   action: () => {
        import('@/utils/icsExport').then(({ downloadICS }) => {
          downloadICS(days, trip.title || 'My Trip');
        }).catch(() => {});
        onClose();
      }},
      { id: 'act-share',     label: 'Share Trip',      sub: 'Copy share link',        icon: Share2,           color: AZURE,   group: 'action',   action: async () => {
        const url = window.location.origin + '/zone/management';
        if (navigator.share) { try { await navigator.share({ title: trip.title || 'My Trip', url }); } catch {} }
        else { try { await navigator.clipboard.writeText(url); } catch {} }
        onClose();
      }},
      { id: 'act-new-trip',  label: 'Plan New Trip',   sub: 'Start from scratch',     icon: RefreshCw,        color: EMERALD, group: 'action',   action: () => { router.push('/'); onClose(); } },
      { id: 'act-ai',        label: 'Ask AI Concierge', sub: 'Get smart suggestions', icon: Zap,              color: VIOLET,  group: 'action',   kbd: 'A', action: () => { sessionStorage.setItem('unitravel-ai-prompt', 'Help me improve my itinerary'); router.push('/zone/flights'); onClose(); } },
    ];

    // ── Day shortcuts ──────────────────────────────────────────────────────
    days.forEach(day => {
      cmds.push({
        id:     `day-${day.id}`,
        label:  `Day ${day.dayNumber} — ${day.destination || 'TBD'}`,
        sub:    `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${day.entities.length} item${day.entities.length !== 1 ? 's' : ''}`,
        icon:   CalendarDays,
        color:  AZURE,
        group:  'day',
        action: () => {
          setActiveDay(day.id);
          onTabSwitch?.('timeline');
          onClose();
        },
      });
    });

    return cmds;
  }, [days, trip, router, onClose, onTabSwitch, onAddExpense, setActiveDay]);

  // Filtered commands
  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.sub?.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Group filtered
  const grouped = useMemo(() => {
    const groups: { label: string; cmds: Command[] }[] = [
      { label: 'Navigate',   cmds: filtered.filter(c => c.group === 'navigate') },
      { label: 'Actions',    cmds: filtered.filter(c => c.group === 'action') },
      { label: 'Days',       cmds: filtered.filter(c => c.group === 'day') },
    ].filter(g => g.cmds.length > 0);
    return groups;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => filtered, [filtered]);

  // Keep selected in bounds
  useEffect(() => {
    if (selected >= flatList.length) setSelected(Math.max(0, flatList.length - 1));
  }, [flatList.length, selected]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatList[selected]?.action();
    }
  }, [flatList, selected]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const budgetPct = budget.total > 0 ? Math.round((budget.spent / budget.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.30)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: -20 }}
        animate={{ scale: 1,    opacity: 1, y: 0    }}
        exit={{    scale: 0.93, opacity: 0, y: -12  }}
        transition={SPRING}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600,
          borderRadius: 22,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(60px) saturate(200%)',
          WebkitBackdropFilter: 'blur(60px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.95)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.24), 0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
          overflow: 'hidden',
          margin: '0 16px',
        }}
      >
        {/* Top gradient line */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #007AFF, #5E5CE6, #30D158)', opacity: 0.80 }} />

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <Search size={16} color="#8E8E93" strokeWidth={2} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, days, actions…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, fontWeight: 500, color: '#1D1D1F', fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          />
          {query && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQuery('')}
              style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={10} color="#8E8E93" strokeWidth={2.5} />
            </motion.button>
          )}
          <kbd style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', background: 'rgba(0,0,0,0.05)', borderRadius: 6, padding: '2px 6px', border: '1px solid rgba(0,0,0,0.08)', letterSpacing: '-0.01em', flexShrink: 0 }}>esc</kbd>
        </div>

        {/* Trip context pill */}
        {!query && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>
            {trip.title && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.16)' }}>
                <Plane size={9} color={AZURE} strokeWidth={2.5} />
                <span style={{ fontSize: 10, fontWeight: 700, color: AZURE, letterSpacing: '-0.01em' }}>{trip.title}</span>
              </div>
            )}
            {days.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
                <CalendarDays size={9} color="#6E6E73" strokeWidth={2} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6E6E73' }}>{days.length} days</span>
              </div>
            )}
            {budget.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, background: budgetPct > 90 ? 'rgba(255,69,58,0.07)' : 'rgba(48,209,88,0.07)', border: `1px solid ${budgetPct > 90 ? 'rgba(255,69,58,0.20)' : 'rgba(48,209,88,0.18)'}` }}>
                <Wallet size={9} color={budgetPct > 90 ? RED : EMERALD} strokeWidth={2} />
                <span style={{ fontSize: 10, fontWeight: 700, color: budgetPct > 90 ? RED : EMERALD }}>{budgetPct}% spent</span>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 8px 8px' }}
        >
          {flatList.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#AEAEB2', fontSize: 13, fontWeight: 500 }}>
              No commands found for "{query}"
            </div>
          ) : (
            grouped.map(({ label, cmds }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 8px 3px' }}>
                  {label}
                </div>
                {cmds.map(cmd => {
                  const globalIdx = flatList.findIndex(c => c.id === cmd.id);
                  const isSelected = globalIdx === selected;
                  const Icon = cmd.icon;
                  return (
                    <motion.button
                      key={cmd.id}
                      data-idx={globalIdx}
                      type="button"
                      onClick={cmd.action}
                      onMouseEnter={() => setSelected(globalIdx)}
                      whileTap={{ scale: 0.99 }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                        padding: '9px 10px', borderRadius: 11, textAlign: 'left',
                        background: isSelected ? `${cmd.color}0E` : 'transparent',
                        border: `1px solid ${isSelected ? cmd.color + '25' : 'transparent'}`,
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'background 0.10s ease, border-color 0.10s ease',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: isSelected ? `${cmd.color}18` : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${isSelected ? cmd.color + '30' : 'rgba(0,0,0,0.06)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.10s ease',
                      }}>
                        <Icon size={14} color={isSelected ? cmd.color : '#636366'} strokeWidth={isSelected ? 2.5 : 2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1D1D1F' : '#3C3C43', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cmd.label}
                        </div>
                        {cmd.sub && (
                          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 400, marginTop: 1, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cmd.sub}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {cmd.kbd && (
                          <kbd style={{ fontSize: 10, fontWeight: 700, color: isSelected ? cmd.color : '#AEAEB2', background: isSelected ? `${cmd.color}12` : 'rgba(0,0,0,0.04)', borderRadius: 5, padding: '1px 5px', border: `1px solid ${isSelected ? cmd.color + '28' : 'rgba(0,0,0,0.07)'}` }}>
                            {cmd.kbd}
                          </kbd>
                        )}
                        {isSelected && (
                          <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.10 }}>
                            <ArrowRight size={12} color={cmd.color} strokeWidth={2.5} />
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', borderTop: '1px solid rgba(0,0,0,0.05)',
          background: 'rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['↑↓', 'navigate'], ['↵', 'select']].map(([key, hint]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', background: 'rgba(0,0,0,0.04)', borderRadius: 5, padding: '1px 5px', border: '1px solid rgba(0,0,0,0.08)' }}>{key}</kbd>
                <span style={{ fontSize: 10, color: '#AEAEB2', fontWeight: 500 }}>{hint}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: '#AEAEB2', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {flatList.length} command{flatList.length !== 1 ? 's' : ''}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
