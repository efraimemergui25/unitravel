'use client';

/**
 * ZoneShell — shared glass container used by every search zone (Stays, Dining,
 * Experiences, Transit). Provides the unified NL hero bar, params row, engine
 * summary pill, and search CTA. Zone pages supply their own param chips and
 * engine drawer contents via render props.
 */

import { ReactNode }                   from 'react';
import { motion, AnimatePresence }     from 'framer-motion';
import {
  Sparkles, RefreshCw, ArrowRight, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';

const SP = { type: 'spring', stiffness: 420, damping: 30 } as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZoneShellProps {
  color:          string;              // primary accent (hex)
  gradient:       string;              // CSS gradient for CTA button
  nlPlaceholder:  string;
  nlValue:        string;
  onNLChange:     (v: string) => void;
  onNLApply:      (v: string) => void;
  nlFocused:      boolean;
  onNLFocus:      () => void;
  onNLBlur:       () => void;

  /** Compact horizontal chips rendered below the NL bar */
  paramsRow?:     ReactNode;

  /** Number of selected engines */
  engineCount:    number;
  /** Label for the engine pill (e.g. "AI · 8 engines") */
  engineLabel:    string;
  enginesOpen:    boolean;
  onEnginesToggle: () => void;
  /** The expandable engine drawer content */
  engineDrawer?:  ReactNode;

  /** Whether the search CTA is enabled */
  canSearch:      boolean;
  onSearch:       () => void;
  /** Search loading state */
  isSearching:    boolean;
  scanProgress:   number;

  /** API status after search */
  apiStatus?:     'ok' | 'needs_api_key' | 'error' | null;
  resultCount?:   number;

  /** Optional extra row below params (e.g. AI verdict banner) */
  extraRow?:      ReactNode;
}

// ── Shell component ───────────────────────────────────────────────────────────

export function ZoneShell({
  color, gradient, nlPlaceholder, nlValue, onNLChange, onNLApply,
  nlFocused, onNLFocus, onNLBlur,
  paramsRow,
  engineCount, engineLabel, enginesOpen, onEnginesToggle, engineDrawer,
  canSearch, onSearch, isSearching, scanProgress,
  apiStatus, resultCount,
  extraRow,
}: ZoneShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SP, delay: 0.04 }}
      style={{
        margin: '0 12px',
        flexShrink: 0,
        borderRadius: 22,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(56px) saturate(200%)',
        WebkitBackdropFilter: 'blur(56px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.96)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,1)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Specular top */}
      <div aria-hidden style={{
        position: 'absolute', left: '4%', right: '4%', top: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent)',
        pointerEvents: 'none', zIndex: 4,
      }} />

      {/* NL hero */}
      <div style={{ padding: '18px 18px 14px' }}>
        <NLHero
          value={nlValue} onChange={onNLChange} onApply={onNLApply}
          focused={nlFocused} onFocus={onNLFocus} onBlur={onNLBlur}
          placeholder={nlPlaceholder} color={color}
          isSearching={isSearching} scanProgress={scanProgress}
          apiStatus={apiStatus} resultCount={resultCount}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.045)', marginInline: 18 }} />

      {/* Params row */}
      {paramsRow && (
        <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', rowGap: 6 }}>
          {paramsRow}
        </div>
      )}

      {/* Extra row (verdict, etc.) */}
      {extraRow && (
        <div style={{ padding: '10px 18px 0' }}>
          {extraRow}
        </div>
      )}

      {/* Engine pill + Search CTA */}
      <div style={{ padding: '12px 18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <motion.button
          onClick={onEnginesToggle}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          transition={SP}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 100, cursor: 'pointer', background: enginesOpen ? `${color}18` : 'rgba(0,0,0,0.05)',
            border: `1px solid ${enginesOpen ? `${color}30` : 'rgba(0,0,0,0.08)'}`,
            fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.18s, border-color 0.18s',
          }}
        >
          <Sparkles size={11} color={enginesOpen ? color : '#6E6E73'} strokeWidth={2} />
          <span style={{ fontSize: 11, fontWeight: 700, color: enginesOpen ? color : '#3C3C43', letterSpacing: '-0.01em' }}>
            {engineLabel}
          </span>
          <motion.div animate={{ rotate: enginesOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={11} color={enginesOpen ? color : '#8E8E93'} strokeWidth={2.5} />
          </motion.div>
        </motion.button>

        <div style={{ flex: 1 }} />

        <motion.button
          onClick={onSearch}
          disabled={!canSearch || isSearching}
          whileHover={canSearch && !isSearching ? { scale: 1.03, boxShadow: `0 8px 28px ${color}55` } : {}}
          whileTap={canSearch ? { scale: 0.97 } : {}}
          animate={{ opacity: canSearch ? 1 : 0.44 }}
          transition={SP}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 26px', borderRadius: 14, background: canSearch ? gradient : 'rgba(0,0,0,0.10)',
            color: 'white', fontSize: 13, fontWeight: 800, letterSpacing: '-0.015em',
            cursor: canSearch && !isSearching ? 'pointer' : 'default',
            boxShadow: canSearch ? `0 4px 18px ${color}44, inset 0 1px 0 rgba(255,255,255,0.22)` : 'none',
            fontFamily: 'inherit', flexShrink: 0,
            transition: 'background 0.24s, box-shadow 0.24s',
          }}
        >
          {isSearching ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                <RefreshCw size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
              </motion.div>
              <span>Scanning {engineCount}…</span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.82 }}>{Math.min(100, scanProgress)}%</span>
            </>
          ) : (
            <>
              <span>{canSearch ? `Search ${engineCount}` : 'Add details'}</span>
              <ArrowRight size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
            </>
          )}
        </motion.button>
      </div>

      {/* Engine drawer */}
      <AnimatePresence>
        {enginesOpen && engineDrawer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(0,0,0,0.045)' }}
          >
            {engineDrawer}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── NL Hero ───────────────────────────────────────────────────────────────────

function NLHero({
  value, onChange, onApply, focused, onFocus, onBlur,
  placeholder, color, isSearching, scanProgress, apiStatus, resultCount,
}: {
  value: string; onChange: (v: string) => void; onApply: (v: string) => void;
  focused: boolean; onFocus: () => void; onBlur: () => void;
  placeholder: string; color: string;
  isSearching: boolean; scanProgress: number;
  apiStatus?: string | null; resultCount?: number;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: focused
          ? `0 0 0 2px ${color}30, 0 4px 20px ${color}18`
          : '0 2px 10px rgba(0,0,0,0.05)',
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '12px 16px', borderRadius: 16,
        background: focused ? 'rgba(252,252,255,0.96)' : 'rgba(248,248,252,0.90)',
        border: `1.5px solid ${focused ? `${color}36` : 'rgba(0,0,0,0.07)'}`,
        transition: 'background 0.18s, border-color 0.18s',
      }}
    >
      <motion.div
        animate={{ color: focused ? color : '#AEAEB2', scale: focused ? 1 : 0.9 }}
        transition={{ duration: 0.16 }}
        style={{ flexShrink: 0 }}
      >
        <Sparkles size={16} strokeWidth={2} style={{ display: 'block' }} />
      </motion.div>

      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onApply(value.trim()); }}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', outline: 'none',
          fontSize: 13, fontWeight: 500, color: '#1D1D1F',
          letterSpacing: '-0.015em', fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          {isSearching && (
            <motion.div key="scan" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: `${color}12`, border: `1px solid ${color}28` }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                <RefreshCw size={9} color={color} strokeWidth={2.5} />
              </motion.div>
              <span style={{ fontSize: 10, fontWeight: 700, color }}>{Math.min(100, scanProgress)}%</span>
            </motion.div>
          )}
          {!isSearching && apiStatus === 'ok' && (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 100, background: 'rgba(48,209,88,0.09)', border: '1px solid rgba(48,209,88,0.22)' }}>
              <CheckCircle2 size={9} color="#30D158" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#30D158' }}>{resultCount} results</span>
            </motion.div>
          )}
          {!isSearching && apiStatus === 'needs_api_key' && (
            <motion.div key="key" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 100, background: 'rgba(255,159,10,0.09)', border: '1px solid rgba(255,159,10,0.22)' }}>
              <AlertTriangle size={9} color="#FF9F0A" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FF9F0A' }}>API key needed</span>
            </motion.div>
          )}
          {!isSearching && apiStatus === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 100, background: 'rgba(255,69,58,0.09)', border: '1px solid rgba(255,69,58,0.22)' }}>
              <XCircle size={9} color="#FF453A" strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FF453A' }}>Error</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => onApply(value.trim())}
              style={{
                width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 3px 10px ${color}44`, flexShrink: 0,
              }}
            >
              <ArrowRight size={11} color="#fff" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Shared param chip ─────────────────────────────────────────────────────────

export function ZoneParamChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
      borderRadius: 100, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
      flexShrink: 0,
    }}>
      {icon}
      {children}
    </div>
  );
}

// ── Shared engine drawer ──────────────────────────────────────────────────────

export function ZoneEngineDrawer({
  engines,
  selected,
  onToggle,
  onAIPick,
  onSelectAll,
  onClear,
  aiPicks,
  color,
}: {
  engines: Array<{ id: string; name: string; icon: string; status?: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAIPick: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  aiPicks: Set<string>;
  color: string;
}) {
  const count = selected.size;

  function dotColor(status?: string): string {
    if (status === 'live')       return '#30D158';
    if (status === 'needs-key')  return '#FF9F0A';
    if (status === 'aggregated') return '#5AC8FA';
    return '#C7C7CC';
  }

  return (
    <div style={{ padding: '14px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap', rowGap: 6 }}>
        <button onClick={onAIPick} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${color}22`, background: `${color}0A`, color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ✦ AI Pick
        </button>
        <button onClick={onSelectAll} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.05)', color: '#3C3C43', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          All {engines.length}
        </button>
        <button onClick={onClear} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${count > 0 ? 'rgba(255,59,48,0.16)' : 'rgba(0,0,0,0.07)'}`, background: count > 0 ? 'rgba(255,59,48,0.07)' : 'transparent', color: count > 0 ? '#FF3B30' : '#AEAEB2', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: '#8E8E93', fontWeight: 500 }}>{count} of {engines.length}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {engines.map(engine => {
          const isActive = selected.has(engine.id);
          const isAI     = aiPicks.has(engine.id);
          const dot      = dotColor(engine.status);
          const isUiOnly = engine.status === 'ui-only' || !engine.status;

          return (
            <motion.button
              key={engine.id}
              onClick={() => onToggle(engine.id)}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.93 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px 5px 9px', borderRadius: 100, cursor: 'pointer',
                background: isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.38)',
                border: `1px solid ${isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.52)'}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                boxShadow: isActive ? `0 3px 14px ${color}22, inset 0 0 10px rgba(255,255,255,0.7)` : 'none',
                fontSize: 10.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? color : isUiOnly ? '#8E8E93' : '#3C3C43',
                fontFamily: 'inherit', opacity: isUiOnly && !isActive ? 0.68 : 1,
                transition: 'background 0.16s, border-color 0.16s, color 0.16s',
              }}
            >
              {isAI && <span style={{ fontSize: 7, color: isActive ? color : '#AEAEB2' }}>✦</span>}
              <span style={{ fontSize: 12 }}>{engine.icon}</span>
              <span>{engine.name}</span>
              {!isUiOnly && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: dot, flexShrink: 0, boxShadow: `0 0 4px ${dot}88` }} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
