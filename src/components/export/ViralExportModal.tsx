'use client';

import { useState, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTravelEngine }          from '@/store/useTravelEngine';
import { sanitizeTripForSharing, encodePayload } from '@/utils/PayloadSanitizer';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;

const GRADIENT = 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)';

type ExportState = 'idle' | 'generating' | 'ready';

// ── Circular progress ─────────────────────────────────────────────────────────

function CircularProgress({ progress }: { progress: number }) {
  const radius  = 28;
  const stroke  = 3;
  const circumference = 2 * Math.PI * radius;
  const offset  = circumference * (1 - progress);

  return (
    <svg
      width={70}
      height={70}
      viewBox="0 0 70 70"
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Track */}
      <circle
        cx={35} cy={35} r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.07)"
        strokeWidth={stroke}
      />
      {/* Fill */}
      <motion.circle
        cx={35} cy={35} r={radius}
        fill="none"
        stroke="url(#grad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: offset }}
        // Instant-fill feel — fast easeOut matching dictation
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      />
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#007AFF" />
          <stop offset="100%" stopColor="#BF5AF2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    // ── Glowing copyable URL (dictated) ───────────────────────────────────────
    <motion.div
      animate={{
        boxShadow: copied
          ? '0 0 0 2px rgba(48,209,88,0.35), inset 0 1px 0 rgba(255,255,255,1)'
          : '0 0 20px rgba(0,122,255,0.12), inset 0 1px 0 rgba(255,255,255,1)',
      }}
      transition={{ duration: 0.25 }}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        padding:        '10px 14px',
        borderRadius:   14,
        background:     'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border:         `1.5px solid ${copied ? 'rgba(48,209,88,0.40)' : 'rgba(255,255,255,0.80)'}`,
        transition:     'border-color 0.25s ease',
      }}
    >
      <span style={{
        flex: 1, fontSize: 10.5, fontWeight: 600, color: '#1C1C1E',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        letterSpacing: '-0.01em',
      }}>
        {url.replace('https://', '')}
      </span>
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        onClick={handleCopy}
        style={{
          paddingBlock: 6, paddingInline: 14,
          borderRadius: 9, border: 'none', cursor: 'pointer',
          background: copied ? 'rgba(48,209,88,0.15)' : GRADIENT,
          color:       copied ? '#30D158' : 'white',
          fontSize:    10, fontWeight: 800,
          fontFamily:  'inherit', letterSpacing: '-0.01em',
          flexShrink:  0, transition: 'background 0.22s, color 0.22s',
          boxShadow:   copied ? 'none' : '0 2px 10px rgba(0,122,255,0.30)',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </motion.button>
    </motion.div>
  );
}

// ── Share buttons — dictated glass squares ────────────────────────────────────

interface ShareSquareProps {
  href?:     string;
  onClick?:  () => void;
  emoji:     string;
  label:     string;
  accentBg:  string;
  accentBorder: string;
  accentText: string;
}

function ShareSquare({ href, onClick, emoji, label, accentBg, accentBorder, accentText }: ShareSquareProps) {
  const inner = (
    <>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: accentText,
        fontFamily: 'inherit', letterSpacing: '-0.01em',
      }}>
        {label}
      </span>
    </>
  );

  const squareStyle: CSSProperties = {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    padding:        '14px 10px',
    borderRadius:   16,
    background:     accentBg,
    border:         `1.5px solid ${accentBorder}`,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow:      'inset 0 1px 0 rgba(255,255,255,0.7)',
    cursor:         'pointer',
    textDecoration: 'none',
    flex:           1,
  };

  return href ? (
    <motion.a
      href={href} target="_blank" rel="noopener noreferrer"
      style={squareStyle}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      {inner}
    </motion.a>
  ) : (
    <motion.button
      onClick={onClick}
      style={squareStyle}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      {inner}
    </motion.button>
  );
}

function ShareButtons({ url, title }: { url: string; title: string }) {
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleNative = async () => {
    try {
      await navigator.share({ title, url, text: `Check out my trip: ${title}` });
    } catch { /* user cancelled or unsupported */ }
  };

  const whatsapp  = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const instagram = `https://www.instagram.com/`;  // Instagram deep-link: copy URL then open
  const twitter   = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  return (
    // ── Glass squares grid (dictated) ─────────────────────────────────────────
    <div style={{ display: 'flex', gap: 10 }}>
      <ShareSquare
        href={whatsapp}
        emoji="💬"
        label="WhatsApp"
        accentBg="rgba(37,211,102,0.10)"
        accentBorder="rgba(37,211,102,0.28)"
        accentText="#1a8a43"
      />
      <ShareSquare
        href={instagram}
        emoji="📸"
        label="Instagram"
        accentBg="rgba(193,53,132,0.08)"
        accentBorder="rgba(193,53,132,0.22)"
        accentText="#c13584"
      />
      {canNativeShare ? (
        <ShareSquare
          onClick={handleNative}
          emoji="📤"
          label="More"
          accentBg="rgba(0,122,255,0.08)"
          accentBorder="rgba(0,122,255,0.22)"
          accentText="#007AFF"
        />
      ) : (
        <ShareSquare
          href={twitter}
          emoji="𝕏"
          label="Post"
          accentBg="rgba(0,0,0,0.05)"
          accentBorder="rgba(0,0,0,0.12)"
          accentText="#1C1C1E"
        />
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ViralExportModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ViralExportModal({ isOpen, onClose }: ViralExportModalProps) {
  const { trip, days } = useTravelEngine();
  const [state,    setState]    = useState<ExportState>('idle');
  const [progress, setProgress] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    if (state !== 'idle') return;
    setState('generating');
    setProgress(0);

    // Instant-fill feel — 12 ticks × 40ms = 480ms total
    let tick = 0;
    const totalTicks = 12;
    const interval = setInterval(() => {
      tick++;
      setProgress(tick / totalTicks);
      if (tick >= totalTicks) {
        clearInterval(interval);

        // Build the real sanitized payload
        const payload = sanitizeTripForSharing({
          title:     trip.title || days.find(d => d.destination)?.destination || 'My Trip',
          startDate: trip.startDate,
          endDate:   trip.endDate,
          travelers: trip.travelers,
          days,
        });
        const encoded = encodePayload(payload);
        const appUrl  = typeof window !== 'undefined'
          ? `${window.location.origin}/trip/${encoded}`
          : `/trip/${encoded}`;

        setShareUrl(appUrl);
        setState('ready');
      }
    }, 40);
  }, [state, trip, days]);

  const hasEntities = days.some(d => d.entities.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="export-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.20)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Modal */}
          <motion.div
            key="export-modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={SPRING}
            // ── Dictated modal CSS ───────────────────────────────────────────
            style={{
              position:        'fixed',
              insetBlockStart: '50%',
              insetInlineStart: '50%',
              transform:       'translate(-50%, -50%)',
              zIndex:          61,
              width:           'min(420px, 90vw)',
              borderRadius:    28,
              background:      'rgba(255,255,255,0.50)',
              backdropFilter:  'blur(48px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
              border:          '1.5px solid rgba(255,255,255,0.60)',
              boxShadow:       'inset 0 1px 0 rgba(255,255,255,1), 0 32px 80px rgba(0,0,0,0.14)',
              padding:         28,
              textAlign:       'center',
            }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', insetBlockStart: 16, insetInlineEnd: 16,
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.07)',
                cursor: 'pointer', fontSize: 14, color: '#6E6E73',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>

            {/* Header */}
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: GRADIENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, margin: '0 auto 16px',
              boxShadow: '0 6px 20px rgba(0,122,255,0.30)',
            }}>
              🌍
            </div>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 900,
              color: '#1C1C1E', letterSpacing: '-0.04em',
              fontFamily: 'inherit',
            }}>
              Share Your Trip
            </h2>
            <p style={{
              margin: 0, marginBlockStart: 6, fontSize: 12,
              color: '#6E6E73', fontWeight: 500, lineHeight: 1.5,
              fontFamily: 'inherit',
            }}>
              Generate a beautiful read-only mini-site of your itinerary. No prices or personal data are shared.
            </p>

            <div style={{ marginBlockStart: 24 }}>
              <AnimatePresence mode="wait">
                {/* Idle */}
                {state === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <motion.button
                      whileHover={hasEntities ? { scale: 1.03, boxShadow: '0 8px 28px rgba(0,122,255,0.35)' } : {}}
                      whileTap={hasEntities ? { scale: 0.97 } : {}}
                      transition={SPRING_POP}
                      onClick={handleGenerate}
                      disabled={!hasEntities}
                      style={{
                        paddingBlock: 14, paddingInline: 32,
                        borderRadius: 14, border: 'none', cursor: hasEntities ? 'pointer' : 'default',
                        background:   hasEntities ? GRADIENT : 'rgba(0,0,0,0.08)',
                        color:        hasEntities ? 'white'   : '#6E6E73',
                        fontSize:     14, fontWeight: 800,
                        letterSpacing: '-0.02em', fontFamily: 'inherit',
                        display:      'flex', alignItems: 'center', gap: 8,
                        margin:       '0 auto',
                        boxShadow:    hasEntities ? '0 4px 18px rgba(0,122,255,0.30)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 16 }}>✦</span>
                      Generate Shareable Mini-Site
                    </motion.button>
                    {!hasEntities && (
                      <p style={{
                        marginBlockStart: 12, fontSize: 11,
                        color: '#6E6E73', fontFamily: 'inherit',
                      }}>
                        Add items to your timeline first.
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Generating */}
                {state === 'generating' && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={SPRING_POP}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 12,
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <CircularProgress progress={progress} />
                      <span style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                      }}>
                        ✈️
                      </span>
                    </div>
                    <p style={{
                      fontSize: 12, fontWeight: 600, color: '#6E6E73',
                      fontFamily: 'inherit',
                    }}>
                      Compiling your itinerary…
                    </p>
                  </motion.div>
                )}

                {/* Ready */}
                {state === 'ready' && shareUrl && (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={SPRING}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                  >
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={SPRING_POP}
                      style={{ fontSize: 28 }}
                    >
                      🎉
                    </motion.div>
                    <p style={{
                      margin: 0, fontSize: 11, fontWeight: 600,
                      color: '#30D158', fontFamily: 'inherit',
                    }}>
                      Your mini-site is ready!
                    </p>
                    <CopyButton url={shareUrl} />
                    <ShareButtons url={shareUrl} title={trip.title || 'My Trip'} />
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setState('idle'); setShareUrl(null); setProgress(0); }}
                      style={{
                        background: 'none', border: 'none',
                        color: '#6E6E73', fontSize: 10, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', marginBlockStart: 4,
                      }}
                    >
                      Regenerate
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
