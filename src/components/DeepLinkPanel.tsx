'use client';

import { ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EngineEntry {
  engineId:     string;
  engineName?:  string;
  status:       string;
  deepLinkUrl?: string;
}

interface Props {
  engineStatus:  EngineEntry[] | null | undefined;
  /** Label shown before the chips, e.g. "Also search on" */
  label?: string;
}

/**
 * Renders clickable "Open on [Engine] →" chips for every engine that
 * returned needs_api_key but has a deepLinkUrl pre-filled with the query.
 * Opens in a new tab — real results, zero "fake" behaviour.
 */
export function DeepLinkPanel({ engineStatus, label = 'Also search on' }: Props) {
  const deepLinks = engineStatus?.filter(
    (e) => e.status === 'needs_api_key' && !!e.deepLinkUrl,
  ) ?? [];

  return (
    <AnimatePresence>
      {deepLinks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(255,255,255,0.90)',
            backdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05), inset 0 1.5px 0 rgba(255,255,255,1)',
            marginTop: 10,
          }}
        >
          <p style={{
            fontSize: 10, fontWeight: 700, color: '#AEAEB2',
            letterSpacing: '0.07em', textTransform: 'uppercase',
            margin: '0 0 8px',
          }}>
            {label}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {deepLinks.map((e, i) => (
              <motion.a
                key={e.engineId}
                href={e.deepLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.03 }}
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 100,
                  background: 'rgba(0,122,255,0.07)',
                  border: '1px solid rgba(0,122,255,0.18)',
                  textDecoration: 'none',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04), inset 0 1.5px 0 rgba(255,255,255,0.90)',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: '#007AFF', letterSpacing: '-0.01em' }}>
                  {e.engineName ?? e.engineId}
                </span>
                <ExternalLink size={9} color="#007AFF" strokeWidth={2.5} />
              </motion.a>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
