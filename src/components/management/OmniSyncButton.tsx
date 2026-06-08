'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence }       from 'framer-motion';
import { useTravelEngine }               from '@/store/useTravelEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 420, damping: 26 } as const;

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

// ── Glass shimmer ─────────────────────────────────────────────────────────────

function GlassShimmer({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="shimmer"
          initial={{ insetInlineStart: '-100%', opacity: 0.6 }}
          animate={{ insetInlineStart: '120%', opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          style={{
            position:    'absolute',
            insetBlock:  0,
            width:       '60%',
            background:  'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
            pointerEvents: 'none',
            borderRadius:  'inherit',
          }}
        />
      )}
    </AnimatePresence>
  );
}

// ── Status label ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SyncState, string> = {
  idle:    '⟳  Sync to Calendar',
  syncing: '✦  Syncing…',
  done:    '✓  Synced',
  error:   '⚠  Try Again',
};

const STATUS_COLOR: Record<SyncState, string> = {
  idle:    'rgba(0,0,0,0.62)',
  syncing: '#007AFF',
  done:    '#30D158',
  error:   '#FF453A',
};

// ── Main export ───────────────────────────────────────────────────────────────

export interface OmniSyncButtonProps {
  accessToken?: string;
  onConnect?:   () => void;
  compact?:     boolean;
}

export function OmniSyncButton({ accessToken, onConnect, compact = false }: OmniSyncButtonProps) {
  const { days }               = useTravelEngine();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [shimmer, setShimmer]  = useState(false);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const abortRef               = useRef<AbortController | null>(null);

  const handleSync = useCallback(async () => {
    if (syncState === 'syncing') return;

    const totalEntities = days.reduce((sum, d) => sum + d.entities.length, 0);
    if (totalEntities === 0) return;

    // No token + no connect handler = ICS download
    const format: 'ics' | 'google' = accessToken ? 'google' : 'ics';

    setSyncState('syncing');
    setShimmer(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/calendar/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body:    JSON.stringify({
          days,
          tripName:    'My Unitravel Trip',
          accessToken: accessToken ?? undefined,
          format,
        }),
      });

      if (format === 'ics' && res.ok) {
        // Trigger file download
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'unitravel-trip.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSyncedCount(totalEntities);
        setSyncState('done');
        setTimeout(() => setSyncState('idle'), 3000);
        return;
      }

      if (res.status === 401) {
        setSyncState('idle');
        onConnect?.();
        return;
      }

      if (!res.ok) {
        setSyncState('error');
        setTimeout(() => setSyncState('idle'), 3000);
        return;
      }

      const data = await res.json() as { synced: number };
      setSyncedCount(data.synced);
      setSyncState('done');
      setTimeout(() => setSyncState('idle'), 3000);

    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setSyncState('error');
        setTimeout(() => setSyncState('idle'), 3000);
      }
    }
  }, [days, syncState, accessToken, onConnect]);

  const totalEntities = days.reduce((s, d) => s + d.entities.length, 0);
  const disabled      = totalEntities === 0 || syncState === 'syncing';

  return (
    <motion.button
      onClick={handleSync}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      transition={SPRING}
      onAnimationComplete={() => { if (shimmer) setShimmer(false); }}
      style={{
        position:       'relative',
        overflow:       'hidden',
        paddingBlock:   compact ? 10 : 14,
        paddingInline:  compact ? 20 : 32,
        borderRadius:   9999,
        border:         '1.5px solid rgba(255,255,255,0.60)',
        background:     syncState === 'done'
          ? 'rgba(48,209,88,0.12)'
          : syncState === 'error'
          ? 'rgba(255,69,58,0.12)'
          : 'rgba(255,255,255,0.30)',
        backdropFilter: 'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        boxShadow:      disabled
          ? 'none'
          : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 40px rgba(0,0,0,0.08)',
        cursor:         disabled ? 'default' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        gap:            7,
        fontSize:       compact ? 11 : 13,
        fontWeight:     700,
        letterSpacing:  '-0.02em',
        fontFamily:     'inherit',
        color:          disabled && syncState === 'idle'
          ? 'rgba(0,0,0,0.28)'
          : STATUS_COLOR[syncState],
        transition:     'background 0.3s, color 0.3s, box-shadow 0.2s',
        userSelect:     'none',
        WebkitUserSelect: 'none',
      }}
      aria-label="Sync trip to calendar"
    >
      <GlassShimmer active={shimmer} />

      {/* Spinning icon during sync */}
      {syncState === 'syncing' ? (
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'inline-block', fontSize: compact ? 11 : 13, flexShrink: 0 }}
          aria-hidden
        >
          ✦
        </motion.span>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.span
          key={syncState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {syncState === 'done' && syncedCount !== null
            ? `✓  ${syncedCount} event${syncedCount !== 1 ? 's' : ''} synced`
            : STATUS_LABEL[syncState]}
        </motion.span>
      </AnimatePresence>

      {/* Entity count chip */}
      {syncState === 'idle' && totalEntities > 0 && (
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize:      9,
            fontWeight:    900,
            background:    'rgba(0,0,0,0.08)',
            borderRadius:  6,
            paddingBlock:  2,
            paddingInline: 6,
            color:         'rgba(0,0,0,0.48)',
            letterSpacing: '0em',
          }}
        >
          {totalEntities}
        </motion.span>
      )}
    </motion.button>
  );
}
