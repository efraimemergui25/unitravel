'use client';

/**
 * PackingList — AI-generated packing list with Claude.
 * Groups items by category, supports check-off, shows progress ring.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import { useTravelEngine }                  from '@/store/useTravelEngine';
import type { PackingCategory, PackingItem, PackingListResponse } from '@/app/api/packing-list/route';
import {
  Sparkles, RefreshCw, CheckCircle2, Circle, ChevronDown, ChevronUp, Package,
} from 'lucide-react';

const SP = { type: 'spring', stiffness: 380, damping: 28 } as const;

// ── Category colours ──────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  clothing:    '#007AFF',
  footwear:    '#5E5CE6',
  toiletries:  '#30D158',
  electronics: '#FF9F0A',
  documents:   '#FF453A',
  health:      '#5AC8FA',
  activities:  '#BF5AF2',
  misc:        '#8E8E93',
};

// ── Progress ring ─────────────────────────────────────────────────────────────
function MiniRing({ pct, color, size = 28 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={3.5} />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round"
          strokeDasharray={`${circ}`}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800, color,
      }}>{Math.round(pct)}</div>
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({
  item, checked, onToggle, color,
}: {
  item: PackingItem; checked: boolean; onToggle: () => void; color: string;
}) {
  return (
    <motion.div
      layout
      onClick={onToggle}
      whileHover={{ x: 2 }}
      transition={SP}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px',
        cursor: 'pointer', borderRadius: 8,
        opacity: checked ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <motion.div
        animate={{ scale: checked ? [1.4, 1] : 1 }}
        transition={{ duration: 0.2 }}
        style={{ flexShrink: 0 }}
      >
        {checked
          ? <CheckCircle2 size={15} color={color} strokeWidth={2.5} />
          : <Circle      size={15} color="rgba(0,0,0,0.18)" strokeWidth={2} />
        }
      </motion.div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: 500, color: '#1D1D1F', letterSpacing: '-0.01em',
          textDecoration: checked ? 'line-through' : 'none',
          transition: 'text-decoration 0.2s',
        }}>
          {item.text}
        </span>
        {item.essential && !checked && (
          <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, color, background: `${color}18`, borderRadius: 4, padding: '1px 5px' }}>
            essential
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
function CategorySection({
  category, checked, onToggle,
}: {
  category: PackingCategory;
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const color = CAT_COLORS[category.id] ?? '#8E8E93';
  const checkedCount = category.items.filter(i => checked.has(i.id)).length;
  const pct = category.items.length > 0 ? (checkedCount / category.items.length) * 100 : 0;

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: 'rgba(255,255,255,0.72)',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <motion.div
        onClick={() => setExpanded(v => !v)}
        whileHover={{ background: 'rgba(0,0,0,0.02)' }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
      >
        <MiniRing pct={pct} color={color} />
        <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{category.icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1D1D1F', flex: 1, letterSpacing: '-0.015em' }}>
          {category.label}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#AEAEB2' }}>
          {checkedCount}/{category.items.length}
        </span>
        {expanded
          ? <ChevronUp size={12} color="#AEAEB2" strokeWidth={2} />
          : <ChevronDown size={12} color="#AEAEB2" strokeWidth={2} />
        }
      </motion.div>

      {/* Items */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column' }}>
              {category.items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  checked={checked.has(item.id)}
                  onToggle={() => onToggle(item.id)}
                  color={color}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PackingList() {
  const trip   = useTravelEngine(s => s.trip);
  const days   = useTravelEngine(s => s.days);
  const [categories,  setCategories]  = useState<PackingCategory[]>([]);
  const [checked,     setChecked]     = useState<Set<string>>(new Set());
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [generated,   setGenerated]   = useState(false);

  const destination = [...new Set(days.map(d => d.destination).filter(Boolean))][0] ?? trip.title ?? 'Unknown';
  const nights      = trip.nights ?? days.length;
  const activities  = [...new Set(days.flatMap(d => d.entities.map(e => e.category)))];

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/packing-list', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          destination,
          nights,
          activities,
          travelers: trip.travelers.length || 2,
        }),
      });
      const data = await res.json() as PackingListResponse;
      if (data.status === 'ok') {
        setCategories(data.categories);
        setChecked(new Set());
        setGenerated(true);
      } else {
        setError(data.message ?? 'Generation failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [destination, nights, activities, trip.travelers.length]);

  const toggleItem = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const totalItems   = categories.reduce((s, c) => s + c.items.length, 0);
  const checkedCount = checked.size;
  const overallPct   = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  // Persist checked state in sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('unitravel-packing-checked');
      if (raw) setChecked(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem('unitravel-packing-checked', JSON.stringify([...checked])); } catch {}
  }, [checked]);

  // Empty / generate state
  if (!generated && !loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 18, padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #5E5CE6, #BF5AF2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(94,92,230,0.32)' }}>
          <Package size={26} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', marginBottom: 6 }}>
            Smart Packing List
          </div>
          <div style={{ fontSize: 12.5, color: '#6E6E73', lineHeight: 1.6, maxWidth: 260 }}>
            AI generates your personalized list based on {destination}, {nights} nights, weather, and your planned activities.
          </div>
        </div>
        <motion.button
          onClick={generate}
          whileHover={{ scale: 1.03, boxShadow: '0 8px 28px rgba(94,92,230,0.38)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '12px 28px',
            borderRadius: 16, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'linear-gradient(135deg, #5E5CE6, #BF5AF2)',
            color: 'white', fontSize: 14, fontWeight: 800, letterSpacing: '-0.015em',
            boxShadow: '0 4px 16px rgba(94,92,230,0.30)',
          }}
        >
          <Sparkles size={15} color="white" strokeWidth={2} />
          Generate my list
        </motion.button>

        {error && (
          <div style={{ fontSize: 11.5, color: '#FF453A', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.20)', borderRadius: 10, padding: '8px 14px' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
          <RefreshCw size={24} color="#5E5CE6" strokeWidth={2} />
        </motion.div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73', letterSpacing: '-0.01em' }}>
          Building your packing list…
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px 10px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <svg width={44} height={44} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4} />
              <motion.circle
                cx={22} cy={22} r={18}
                fill="none" stroke="#5E5CE6" strokeWidth={4} strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 18}`}
                animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - overallPct / 100) }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(94,92,230,0.6))' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#5E5CE6' }}>
              {Math.round(overallPct)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Pack for {destination}</div>
            <div style={{ fontSize: 10.5, color: '#8E8E93', fontWeight: 500 }}>
              {checkedCount}/{totalItems} items packed
            </div>
          </div>
        </div>
        <motion.button
          onClick={generate}
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          title="Regenerate list"
          style={{
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(94,92,230,0.09)', border: '1px solid rgba(94,92,230,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RefreshCw size={12} color="#5E5CE6" strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Categories */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 12px 24px',
        display: 'flex', flexDirection: 'column', gap: 8,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.07) transparent',
      }}>
        {categories.map(cat => (
          <CategorySection
            key={cat.id}
            category={cat}
            checked={checked}
            onToggle={toggleItem}
          />
        ))}
      </div>
    </div>
  );
}
