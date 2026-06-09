'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import { Bell, BellRing, X, Eye, EyeOff, Minus } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WatchCategory = 'flight' | 'hotel';

export interface PriceWatchEntry {
  id:         string;
  category:   WatchCategory;
  label:      string;        // e.g. "TLV → JFK · Business · 2 pax"
  basePrice:  number;        // price when watch was created
  lastPrice:  number;        // most recent checked price
  createdAt:  number;
  lastChecked:number;
  alertFired: boolean;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = 'unitravel_price_watches';

function loadWatches(): PriceWatchEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); }
  catch { return []; }
}

function saveWatches(entries: PriceWatchEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtPrice(n: number) { return `$${n.toLocaleString()}`; }

// ── Hook: useAddWatch ─────────────────────────────────────────────────────────

/** Call this from any search form to add a new price watch. */
export function useAddWatch() {
  return useCallback((
    category: WatchCategory,
    label:    string,
    price:    number,
  ) => {
    const watches = loadWatches();
    const id = `${category}-${Date.now()}`;
    const entry: PriceWatchEntry = {
      id, category, label,
      basePrice:   price,
      lastPrice:   price,
      createdAt:   Date.now(),
      lastChecked: Date.now(),
      alertFired:  false,
    };
    saveWatches([entry, ...watches.slice(0, 19)]); // keep max 20
    // Dispatch custom event so PriceWatchPanel refreshes
    window.dispatchEvent(new Event('pricewatch-update'));
  }, []);
}

// ── Pill shown next to search button ─────────────────────────────────────────

export function WatchButton({
  label, price, category, onAdded,
}: {
  label: string; price: number; category: WatchCategory;
  onAdded?: () => void;
}) {
  const add   = useAddWatch();
  const [added, setAdded] = useState(false);
  const [already, setAlready] = useState(false);

  // Check localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const watches = loadWatches();
    setAlready(watches.some(w => w.label === label && w.category === category));
  }, [label, category]);

  const handle = () => {
    if (already || added) return;
    add(category, label, price);
    setAdded(true);
    onAdded?.();
  };

  const isActive = already || added;

  return (
    <motion.button
      whileHover={isActive ? {} : { scale: 1.04 }}
      whileTap={isActive ? {} : { scale: 0.96 }}
      onClick={handle}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         5,
        padding:     '5px 11px',
        borderRadius:100,
        cursor:      isActive ? 'default' : 'pointer',
        fontFamily:  'inherit',
        background:  isActive ? 'rgba(48,209,88,0.09)' : 'rgba(0,122,255,0.08)',
        border:      `1px solid ${isActive ? 'rgba(48,209,88,0.25)' : 'rgba(0,122,255,0.20)'}`,
        fontSize:    10,
        fontWeight:  700,
        color:       isActive ? '#30D158' : '#007AFF',
        transition:  'all 0.18s ease',
      }}
    >
      {isActive ? <BellRing size={10} strokeWidth={2.5} /> : <Bell size={10} strokeWidth={2} />}
      {isActive ? 'Watching' : 'Watch price'}
    </motion.button>
  );
}

// ── Full panel: shown in sidebar / management ─────────────────────────────────

export function PriceWatchPanel() {
  const [watches,  setWatches]  = useState<PriceWatchEntry[]>([]);
  const [visible,  setVisible]  = useState(true);

  const refresh = useCallback(() => setWatches(loadWatches()), []);

  // Load on mount and listen for updates from WatchButton
  useEffect(() => {
    refresh();
    window.addEventListener('pricewatch-update', refresh);
    return () => window.removeEventListener('pricewatch-update', refresh);
  }, [refresh]);

  const remove = (id: string) => {
    const next = watches.filter(w => w.id !== id);
    saveWatches(next);
    setWatches(next);
  };

  if (!watches.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <motion.button
        onClick={() => setVisible(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '11px 14px', background: 'transparent',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          borderBottom: visible ? '1px solid rgba(0,0,0,0.05)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={13} color="#6E6E73" strokeWidth={2} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
            Price Watch
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 100,
            background: 'rgba(0,0,0,0.07)', color: '#6E6E73',
            border: '1px solid rgba(0,0,0,0.10)',
          }}>
            {watches.length} saved
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
            background: 'rgba(0,122,255,0.07)', color: '#007AFF',
            border: '1px solid rgba(0,122,255,0.16)',
          }}>
            Demo
          </span>
        </div>
        {visible ? <EyeOff size={12} color="#AEAEB2" strokeWidth={2} /> : <Eye size={12} color="#AEAEB2" strokeWidth={2} />}
      </motion.button>

      {/* Entries */}
      <AnimatePresence>
        {visible && watches.map(w => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid rgba(0,0,0,0.04)' }}
          >
            <div style={{ padding: '9px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.025em' }}>
                      {fmtPrice(w.basePrice)}
                    </span>
                    <span style={{ fontSize: 9.5, color: '#AEAEB2', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Minus size={9} strokeWidth={2} /> at time of search
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#AEAEB2', marginTop: 2 }}>
                    Saved {new Date(w.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </div>
                </div>

                <button
                  onClick={() => remove(w.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                  aria-label="Remove watch"
                >
                  <X size={11} color="#AEAEB2" strokeWidth={2} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
