'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { EngineAvailability } from '@/types/dining';

export interface TableSlotGridProps {
  engines:        EngineAvailability[];
  restaurantName: string;
}

const CELL_W = 44;
const CELL_H = 34;
const LABEL_W = 90;

const DIFF_COLORS: Record<string, string> = {
  easy:       '#30D158',
  moderate:   '#FF9F0A',
  hard:       '#FF453A',
  impossible: '#636366',
};

export const TableSlotGrid = memo(function TableSlotGrid({ engines }: TableSlotGridProps) {
  if (engines.length === 0) return null;

  const timeLabels = engines[0].slots.map(s => s.label);

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Table Availability
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { dot: '#30D158',    ring: false, label: 'Available'     },
            { dot: 'rgba(0,0,0,0.12)', ring: false, label: 'Full'    },
            { dot: '#FF9F0A',    ring: true,  label: 'Matches your itinerary' },
          ].map(({ dot, ring, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: ring ? 12 : 8, height: ring ? 12 : 8,
                borderRadius: '50%', background: dot,
                boxShadow: ring ? `0 0 6px ${dot}` : undefined,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 9, color: '#8E8E93' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ minWidth: LABEL_W + timeLabels.length * CELL_W }}>
        {/* Time header */}
        <div style={{ display: 'flex', marginBottom: 4 }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }} />
          {timeLabels.map(label => (
            <div key={label} style={{
              width:      CELL_W, flexShrink: 0,
              textAlign:  'center', fontSize: 9, fontWeight: 600,
              color:      label >= '19:00' && label <= '20:30' ? '#FF9F0A' : '#8E8E93',
              paddingBottom: 4,
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Engine rows */}
        {engines.map((eng, rowIdx) => (
          <div key={eng.engineId} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            {/* Engine name */}
            <div style={{
              width: LABEL_W, flexShrink: 0,
              fontSize: 10, fontWeight: 600, color: '#3C3C43',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              paddingRight: 8,
            }}>
              {eng.engineName}
            </div>

            {/* Slots */}
            {eng.slots.map((slot, colIdx) => {
              const isMatchAvail = slot.isMatch && slot.available;
              const delay        = rowIdx * 0.05 + colIdx * 0.018;

              return (
                <div key={slot.label} style={{ width: CELL_W, height: CELL_H, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {/* Match column background */}
                  {slot.isMatch && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(255,159,10,0.05)',
                      borderRadius: 4,
                    }} />
                  )}

                  {isMatchAvail ? (
                    /* Glowing match slot */
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay, type: 'spring', stiffness: 460, damping: 22 }}
                    >
                      <motion.div
                        animate={{ boxShadow: ['0 0 0px #FF9F0A00', '0 0 12px #FF9F0A90', '0 0 0px #FF9F0A00'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: rowIdx * 0.3 }}
                        style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: '#FF9F0A',
                          border: '2px solid rgba(255,255,255,0.9)',
                        }}
                      />
                    </motion.div>
                  ) : slot.available ? (
                    /* Available */
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay, type: 'spring', stiffness: 460, damping: 24 }}
                      style={{ width: 10, height: 10, borderRadius: '50%', background: '#30D158' }}
                    />
                  ) : (
                    /* Unavailable */
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay, duration: 0.2 }}
                      style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,0,0,0.12)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Time zone hint */}
        <div style={{
          marginTop: 8, display: 'flex',
          paddingLeft: LABEL_W,
        }}>
          {timeLabels.map(label => (
            <div key={label} style={{
              width: CELL_W, flexShrink: 0,
              background: label >= '19:00' && label <= '20:30' ? 'rgba(255,159,10,0.08)' : undefined,
              height: 3,
              borderRadius: 2,
            }} />
          ))}
        </div>
        <div style={{ paddingLeft: LABEL_W + CELL_W * 2, fontSize: 9, color: '#FF9F0A', marginTop: 3, fontWeight: 600 }}>
          ← Prime dinner window
        </div>
      </div>
    </div>
  );
});
