'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarSync } from '@/services/CalendarSync';
import { useTravelEngine } from '@/store/useTravelEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'done' | 'error';
type OptionState = 'idle' | 'loading' | 'done' | 'pending';

// ── Sub-components ────────────────────────────────────────────────────────────

function SyncDot({ syncState }: { syncState: SyncState }) {
  const base: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  };

  if (syncState === 'syncing') {
    return (
      <motion.span
        style={{ ...base, background: '#FFFFFF', opacity: 0.5 }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  if (syncState === 'done') {
    return (
      <motion.span
        style={{ ...base, background: '#30D158' }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      />
    );
  }

  if (syncState === 'error') {
    return <span style={{ ...base, background: '#FF6B6B' }} />;
  }

  // idle
  return <span style={{ ...base, background: 'rgba(255,255,255,0.35)' }} />;
}

function CountBadge({ count, syncState }: { count: number; syncState: SyncState }) {
  if (syncState === 'done') {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#30D158',
          borderRadius: 999,
          paddingInline: 7,
          paddingBlock: 2,
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1,
          minWidth: 20,
        }}
      >
        ✓
      </motion.span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#007AFF',
        borderRadius: 999,
        paddingInline: 7,
        paddingBlock: 2,
        fontSize: 11,
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1,
        minWidth: 20,
      }}
    >
      {count}
    </span>
  );
}

function OptionRow({
  icon,
  label,
  sublabel,
  optionState,
  loadingLabel,
  doneLabel,
  pendingLabel,
  onClick,
}: {
  icon: string;
  label: string;
  sublabel: string;
  optionState: OptionState;
  loadingLabel: string;
  doneLabel: string;
  pendingLabel: string;
  onClick: () => void;
}) {
  const isActive = optionState !== 'idle';

  const displayLabel =
    optionState === 'loading' ? loadingLabel :
    optionState === 'done'    ? doneLabel    :
    optionState === 'pending' ? pendingLabel :
    sublabel;

  return (
    <motion.button
      onClick={onClick}
      disabled={isActive}
      whileHover={isActive ? {} : { backgroundColor: 'rgba(255,255,255,0.10)' }}
      whileTap={isActive ? {} : { scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        paddingBlock: 12,
        paddingInline: 16,
        background: 'transparent',
        border: 'none',
        borderRadius: 12,
        cursor: isActive ? 'default' : 'pointer',
        textAlign: 'start',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        style={{
          fontSize: 22,
          lineHeight: 1,
          flexShrink: 0,
          width: 32,
          textAlign: 'center',
        }}
      >
        {icon}
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
        <motion.span
          key={optionState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            fontSize: 12,
            color:
              optionState === 'done'
                ? '#30D158'
                : optionState === 'pending'
                ? 'rgba(255,255,255,0.55)'
                : 'rgba(255,255,255,0.50)',
            lineHeight: 1.3,
          }}
        >
          {displayLabel}
        </motion.span>
      </span>

      {optionState === 'idle' && (
        <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: 14 }}>→</span>
      )}

      {optionState === 'loading' && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}
        >
          ⟳
        </motion.span>
      )}
    </motion.button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CalendarSyncButton() {
  const days = useTravelEngine(s => s.days);
  const trip = useTravelEngine(s => s.trip);

  const [isOpen, setIsOpen]           = useState(false);
  const [syncState, setSyncState]     = useState<SyncState>('idle');
  const [syncedCount, setSyncedCount] = useState(0);
  const [appleState, setAppleState]   = useState<OptionState>('idle');
  const [googleState, setGoogleState] = useState<OptionState>('idle');

  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-calendar-sync]')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Early return when timeline is empty
  if (!CalendarSync.hasEntities(days)) return null;

  const entityCount = CalendarSync.entityCount(days);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleApple() {
    if (appleState !== 'idle') return;
    setSyncState('syncing');
    setAppleState('loading');
    // Brief 600ms delay for perceptible feedback
    await new Promise(r => setTimeout(r, 600));
    try {
      CalendarSync.exportICS(days, trip.title);
      setAppleState('done');
      setSyncState('done');
      setSyncedCount(entityCount);
    } catch {
      setAppleState('idle');
      setSyncState('error');
    }
  }

  function handleGoogle() {
    if (googleState !== 'idle') return;

    // Google OAuth credentials not configured → fall back to ICS download
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      handleApple();
      return;
    }

    setSyncState('syncing');
    setGoogleState('loading');
    try {
      CalendarSync.connectGoogle(
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        window.location.origin + '/api/calendar/callback',
      );
      // Can't know when popup auth completes — show "awaiting" state
      setTimeout(() => setGoogleState('pending'), 600);
      setTimeout(() => setSyncState('idle'), 800);
    } catch {
      setGoogleState('idle');
      setSyncState('error');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      data-calendar-sync
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {/* Trigger button */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        initial={false}
        whileHover={{ scale: 1.04, background: 'rgba(255,255,255,0.12)' }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          paddingBlock: 7,
          paddingInline: 13,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 999,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.90)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          whiteSpace: 'nowrap',
        }}
        aria-label="Open calendar sync"
        aria-expanded={isOpen}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>📅</span>
        <span>Sync</span>
        <SyncDot syncState={syncState} />
        <CountBadge count={entityCount} syncState={syncState} />
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{
              position: 'absolute',
              insetInlineEnd: 0,
              insetBlockStart: '100%',
              marginBlockStart: 8,
              width: 300,
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.90)',
              borderRadius: 18,
              boxShadow:
                '0 8px 40px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.60) inset',
              overflow: 'hidden',
              zIndex: 50,
            }}
          >
            {/* Header */}
            <div
              style={{
                paddingBlock: 14,
                paddingInline: 16,
                borderBlockEnd: '1px solid rgba(0,0,0,0.06)',
                background: 'rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBlockEnd: 3,
                }}
              >
                <span style={{ fontSize: 16 }}>📅</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'rgba(0,0,0,0.85)',
                  }}
                >
                  Calendar Sync
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.45)',
                  margin: 0,
                  paddingInlineStart: 24,
                }}
              >
                {entityCount} event{entityCount !== 1 ? 's' : ''} ready to export
              </p>
            </div>

            {/* Options */}
            <div
              style={{
                paddingBlock: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <OptionRow
                icon="🍎"
                label="Apple Calendar"
                sublabel="Download .ics file"
                optionState={appleState}
                loadingLabel="📥 Downloading..."
                doneLabel="✅ Downloaded"
                pendingLabel=""
                onClick={handleApple}
              />

              <div
                style={{
                  marginInline: 16,
                  borderBlockStart: '1px solid rgba(0,0,0,0.06)',
                }}
              />

              <OptionRow
                icon="🔵"
                label="Google Calendar"
                sublabel="Connect & sync"
                optionState={googleState}
                loadingLabel="🔗 Opening Google..."
                doneLabel="✅ Connected"
                pendingLabel="⟳ Awaiting auth..."
                onClick={handleGoogle}
              />
            </div>

            {/* Footer */}
            <div
              style={{
                paddingBlock: 10,
                paddingInline: 16,
                borderBlockStart: '1px solid rgba(0,0,0,0.06)',
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(0,0,0,0.38)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>⚡</span>
                <span>Includes transit auto-blocks</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CalendarSyncButton;
