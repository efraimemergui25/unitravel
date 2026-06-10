'use client';

import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EngineStatusItem {
  engineId:    string;
  engineName:  string;
  status:      'ok' | 'needs_api_key' | 'error' | 'timeout';
  count:       number;
  latencyMs?:  number;
  setupUrl?:   string;
}

interface Props {
  engines:     EngineStatusItem[];
  accentColor?: string;
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: EngineStatusItem['status'] }) {
  const color =
    status === 'ok'           ? '#30D158' :
    status === 'needs_api_key'? '#FF9F0A' :
    status === 'timeout'      ? '#FF9F0A' :
                                '#FF453A';
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 22 }}
      style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: color,
        boxShadow: `0 0 5px ${color}88`,
        display: 'inline-block',
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EngineStatusStrip({ engines, accentColor = '#007AFF' }: Props) {
  if (!engines || engines.length === 0) return null;

  const okCount     = engines.filter(e => e.status === 'ok').length;
  const totalResults = engines.reduce((s, e) => s + (e.status === 'ok' ? e.count : 0), 0);
  const avgLatency  = engines.filter(e => e.latencyMs).reduce((s, e, _, a) => s + (e.latencyMs ?? 0) / a.length, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '8px 12px',
          flexShrink: 0,
        }}
      >
        {/* Summary row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Searched
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, color: accentColor,
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}22`,
              padding: '1px 7px', borderRadius: 100,
            }}>
              {okCount}/{engines.length} engines
            </span>
          </div>
          {totalResults > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#30D158' }}>
              {totalResults} results
            </span>
          )}
          {avgLatency > 0 && (
            <span style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 500 }}>
              avg {Math.round(avgLatency)}ms
            </span>
          )}
        </div>

        {/* Per-engine pills — horizontally scrollable */}
        <div style={{
          display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2,
          scrollbarWidth: 'none',
        }}>
          {engines.map((e, i) => {
            const isOk    = e.status === 'ok';
            const needKey = e.status === 'needs_api_key';
            const isErr   = e.status === 'error' || e.status === 'timeout';

            const bg     = isOk ? 'rgba(48,209,88,0.08)' : needKey ? 'rgba(255,159,10,0.08)' : 'rgba(255,69,58,0.07)';
            const border = isOk ? 'rgba(48,209,88,0.22)' : needKey ? 'rgba(255,159,10,0.22)' : 'rgba(255,69,58,0.18)';
            const textColor = isOk ? '#30D158' : needKey ? '#FF9F0A' : '#FF453A';

            return (
              <motion.div
                key={e.engineId}
                initial={{ opacity: 0, scale: 0.88, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 420, damping: 28 }}
                title={
                  isOk    ? `${e.engineName}: ${e.count} results in ${e.latencyMs}ms` :
                  needKey ? `${e.engineName}: API key required` :
                            `${e.engineName}: Failed`
                }
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px', borderRadius: 100,
                  background: bg, border: `1px solid ${border}`,
                  flexShrink: 0, cursor: needKey && e.setupUrl ? 'pointer' : 'default',
                }}
                onClick={needKey && e.setupUrl ? () => window.open(e.setupUrl, '_blank') : undefined}
              >
                <StatusDot status={e.status} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: textColor, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                  {e.engineName}
                </span>
                {isOk && e.count > 0 && (
                  <span style={{ fontSize: 8.5, fontWeight: 600, color: '#30D158', opacity: 0.8 }}>
                    {e.count}
                  </span>
                )}
                {needKey && (
                  <span style={{ fontSize: 8, color: '#FF9F0A', fontWeight: 700 }}>🔑</span>
                )}
                {isErr && (
                  <span style={{ fontSize: 8 }}>✕</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
