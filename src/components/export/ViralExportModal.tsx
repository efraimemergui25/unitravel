'use client';

import { useState, useCallback } from 'react';
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
        transition={{ duration: 0.4, ease: 'easeOut' }}
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
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            8,
      padding:        '8px 12px',
      borderRadius:   14,
      background:     'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border:         '1.5px solid rgba(255,255,255,0.70)',
      boxShadow:      'inset 0 1px 0 rgba(255,255,255,1)',
    }}>
      <span style={{
        flex: 1, fontSize: 10.5, fontWeight: 600, color: '#1C1C1E',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      }}>
        {url.replace('https://', '')}
      </span>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        onClick={handleCopy}
        style={{
          paddingBlock: 5, paddingInline: 12,
          borderRadius: 8, border: 'none', cursor: 'pointer',
          background: copied ? '#30D15820' : GRADIENT,
          color:       copied ? '#30D158'  : 'white',
          fontSize:    10, fontWeight: 800,
          fontFamily:  'inherit', letterSpacing: '-0.01em',
          flexShrink:  0, transition: 'background 0.2s, color 0.2s',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </motion.button>
    </div>
  );
}

// ── Share buttons ─────────────────────────────────────────────────────────────

function ShareButtons({ url, title }: { url: string; title: string }) {
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleNative = async () => {
    try {
      await navigator.share({ title, url, text: `Check out my trip: ${title}` });
    } catch { /* user cancelled or unsupported */ }
  };

  const whatsapp  = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const twitter   = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {canNativeShare && (
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleNative}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 border border-white/60 backdrop-blur-md text-[11px] font-bold text-[#1C1C1E] cursor-pointer"
          style={{ fontFamily: 'inherit', letterSpacing: '-0.01em' }}
        >
          📤 Share
        </motion.button>
      )}
      <motion.a
        href={whatsapp} target="_blank" rel="noopener noreferrer"
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/10 border border-[#25D366]/30 backdrop-blur-md text-[11px] font-bold text-[#25D366] cursor-pointer"
        style={{ textDecoration: 'none', fontFamily: 'inherit', letterSpacing: '-0.01em' }}
      >
        💬 WhatsApp
      </motion.a>
      <motion.a
        href={twitter} target="_blank" rel="noopener noreferrer"
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 backdrop-blur-md text-[11px] font-bold text-[#1DA1F2] cursor-pointer"
        style={{ textDecoration: 'none', fontFamily: 'inherit', letterSpacing: '-0.01em' }}
      >
        𝕏 Post
      </motion.a>
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

    // Animate progress while building payload
    let tick = 0;
    const totalTicks = 20;
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
    }, 50);
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
            style={{
              position:        'fixed',
              insetBlockStart: '50%',
              insetInlineStart: '50%',
              transform:       'translate(-50%, -50%)',
              zIndex:          61,
              width:           'min(420px, 90vw)',
              borderRadius:    28,
              background:      'rgba(255,255,255,0.65)',
              backdropFilter:  'blur(48px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
              border:          '1.5px solid rgba(255,255,255,0.80)',
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
