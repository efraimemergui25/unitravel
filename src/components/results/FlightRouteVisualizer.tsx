'use client';

import { motion, AnimatePresence } from 'framer-motion';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;
const AMBER  = '#FF9F0A';
const BLUE   = '#007AFF';
const GREEN  = '#30D158';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Layover {
  airport:     string;
  code:        string;
  durationLabel: string;
  durationMin: number;
}

export interface FlightRouteVisualizerProps {
  origin:       string;
  destination:  string;
  departure:    string;
  arrival:      string;
  arrivalNote:  string;
  totalMin:     number;
  layovers:     Layover[];
  airline:      string;
  flightNumbers: string[];
  isRtl?:       boolean;
}

// ── Segment label ─────────────────────────────────────────────────────────────

function SegmentLabel({ code, time, note, align }: {
  code:  string;
  time:  string;
  note?: string;
  align: 'start' | 'end';
}) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     align === 'start' ? 'flex-start' : 'flex-end',
      gap:            2,
      flexShrink:     0,
    }}>
      <span style={{
        fontSize:      18,
        fontWeight:    900,
        color:         '#1C1C1E',
        letterSpacing: '-0.03em',
        fontFamily:    'inherit',
        lineHeight:    1,
      }}>
        {code}
      </span>
      <span style={{
        fontSize:   12,
        fontWeight: 700,
        color:      BLUE,
        fontFamily: 'inherit',
        lineHeight: 1,
      }}>
        {time}
        {note && (
          <span style={{ fontSize: 9, color: AMBER, marginInlineStart: 2, fontWeight: 900 }}>
            {note}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Layover dot on the route line ─────────────────────────────────────────────

function LayoverDot({ pct, code, durationLabel, index }: {
  pct:           number; // 0–100, position along the track
  code:          string;
  durationLabel: string;
  index:         number;
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING, delay: 0.08 + index * 0.06 }}
      style={{
        position:        'absolute',
        insetInlineStart: `${pct}%`,
        transform:       'translateX(-50%)',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        gap:             4,
        zIndex:          2,
      }}
    >
      {/* Glowing amber dot */}
      <motion.div
        animate={{
          boxShadow: [
            `0 0 6px ${AMBER}80`,
            `0 0 14px ${AMBER}cc`,
            `0 0 6px ${AMBER}80`,
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:        12, height: 12,
          borderRadius: '50%',
          background:   AMBER,
          border:       '2px solid rgba(255,255,255,0.90)',
          position:     'relative',
          zIndex:       2,
        }}
      />

      {/* Label below dot */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            1,
        marginBlockStart: 4,
      }}>
        <span style={{
          fontSize:      10,
          fontWeight:    900,
          color:         AMBER,
          fontFamily:    'inherit',
          letterSpacing: '-0.01em',
          whiteSpace:    'nowrap',
        }}>
          {code}
        </span>
        <span style={{
          fontSize:   9,
          fontWeight: 600,
          color:      '#6E6E73',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}>
          {durationLabel}
        </span>
      </div>
    </motion.div>
  );
}

// ── Duration breakdown bar ────────────────────────────────────────────────────

function SegmentBar({
  widthPct,
  label,
  color,
  delay,
}: {
  widthPct: number;
  label:    string;
  color:    string;
  delay:    number;
}) {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: `${widthPct}%`, opacity: 1 }}
      transition={{ ...SPRING, delay }}
      style={{
        height:         4,
        borderRadius:   999,
        background:     color,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        overflow:       'hidden',
        minWidth:       widthPct > 5 ? 20 : 0,
      }}
    >
      {widthPct > 12 && (
        <span style={{
          fontSize:   8, fontWeight: 700, color: 'white',
          letterSpacing: '0.02em', whiteSpace: 'nowrap',
          paddingInline: 3,
          opacity: 0.9,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {label}
        </span>
      )}
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function FlightRouteVisualizer({
  origin,
  destination,
  departure,
  arrival,
  arrivalNote,
  totalMin,
  layovers,
  airline,
  flightNumbers,
  isRtl = false,
}: FlightRouteVisualizerProps) {
  // Calculate positions: each layover's position along the route line
  // is proportional to the cumulative flight time up to that point.
  // Total = sum of flight segments + sum of layover durations.
  const layoverTotalMin = layovers.reduce((s, l) => s + l.durationMin, 0);
  const flightTotalMin  = totalMin - layoverTotalMin;

  // Distribute flight time evenly across N+1 segments
  const numSegments = layovers.length + 1;
  const segMin      = flightTotalMin / numSegments;

  // Compute cumulative position percentages for each layover dot
  const layoverPositions = layovers.map((lay, i) => {
    const cumFlightMin  = segMin * (i + 1);
    const cumLayoverMin = layovers.slice(0, i).reduce((s, l) => s + l.durationMin, 0);
    const cumTotal      = cumFlightMin + cumLayoverMin;
    return Math.round((cumTotal / Math.max(totalMin, 1)) * 100);
  });

  // Duration segments for the colored bar (flight, layover, flight, ...)
  type Segment = { min: number; isLayover: boolean; label: string };
  const segments: Segment[] = [];
  for (let i = 0; i < numSegments; i++) {
    segments.push({ min: segMin, isLayover: false, label: flightNumbers[i] ?? airline });
    if (i < layovers.length && layovers[i]) {
      segments.push({
        min:       layovers[i]!.durationMin,
        isLayover: true,
        label:     `${layovers[i]!.code} layover`,
      });
    }
  }
  const totalBarMin = segments.reduce((s, g) => s + g.min, 0);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ ...SPRING, duration: 0.3 }}
      style={{
        overflow:      'hidden',
        paddingBlock:  16,
        paddingInline: 20,
        direction:     isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Airline + flight numbers */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        marginBlockEnd: 18,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 800, color: '#6E6E73',
          letterSpacing: '-0.01em', fontFamily: 'inherit',
        }}>
          {airline}
        </span>
        {flightNumbers.map((fn, i) => (
          <span
            key={fn}
            style={{
              fontSize:      9.5,
              fontWeight:    700,
              color:         'white',
              background:    BLUE,
              borderRadius:  6,
              paddingBlock:  2, paddingInline: 6,
              letterSpacing: '-0.01em',
              fontFamily:    'inherit',
            }}
          >
            {fn}
          </span>
        ))}
      </div>

      {/* Route diagram */}
      <div style={{
        display:       'flex',
        alignItems:    'flex-start',
        gap:           12,
        position:      'relative',
      }}>
        {/* Origin */}
        <SegmentLabel code={origin} time={departure} align="start" />

        {/* Route track */}
        <div style={{
          flex:          1,
          minWidth:      0,
          position:      'relative',
          display:       'flex',
          flexDirection: 'column',
          gap:           0,
          paddingBlockStart: 8,
        }}>
          {/* Dashed track line */}
          <div style={{
            position:       'relative',
            height:         2,
            background:     'none',
            border:         'none',
            borderBlockStart: '2px dashed rgba(255,255,255,0.50)',
            marginBlockEnd: 20,
          }} />

          {/* Layover dots positioned along the line */}
          <div style={{
            position:        'absolute',
            insetInlineStart: 0,
            insetInlineEnd:   0,
            insetBlockStart:  2, // align with the center of the dashed line
            height:          80,
          }}>
            {/* Origin node */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...SPRING, delay: 0.04 }}
              style={{
                position:        'absolute',
                insetInlineStart: 0,
                transform:       'translateX(-50%)',
                width:           10, height: 10,
                borderRadius:    '50%',
                background:      BLUE,
                border:          '2px solid rgba(255,255,255,0.9)',
                boxShadow:       `0 0 8px ${BLUE}80`,
                zIndex:          2,
                top:             -4,
              }}
            />

            {/* Layover dots */}
            {layovers.map((lay, i) => (
              <LayoverDot
                key={lay.code}
                pct={layoverPositions[i] ?? 50}
                code={lay.code}
                durationLabel={lay.durationLabel}
                index={i}
              />
            ))}

            {/* Destination node */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...SPRING, delay: 0.12 }}
              style={{
                position:       'absolute',
                insetInlineEnd: 0,
                transform:      'translateX(50%)',
                width:          10, height: 10,
                borderRadius:   '50%',
                background:     GREEN,
                border:         '2px solid rgba(255,255,255,0.9)',
                boxShadow:      `0 0 8px ${GREEN}80`,
                zIndex:         2,
                top:            -4,
              }}
            />
          </div>

          {/* Duration breakdown bar */}
          <div style={{
            display:    'flex',
            gap:        2,
            marginBlockStart: 36,
          }}>
            {segments.map((seg, i) => (
              <SegmentBar
                key={i}
                widthPct={(seg.min / totalBarMin) * 100}
                label={seg.label}
                color={seg.isLayover ? `${AMBER}60` : `${BLUE}80`}
                delay={0.1 + i * 0.04}
              />
            ))}
          </div>

          {/* Total duration label */}
          <div style={{
            display:        'flex',
            justifyContent: 'center',
            marginBlockStart: 6,
          }}>
            <span style={{
              fontSize:   10,
              fontWeight: 700,
              color:      '#8E8E93',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}>
              {Math.floor(totalMin / 60)}h {totalMin % 60}m total
              {layovers.length > 0 && (
                <span style={{ color: AMBER }}>
                  {' · '}
                  {layovers.length} stop{layovers.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Destination */}
        <SegmentLabel
          code={destination}
          time={arrival}
          note={arrivalNote}
          align="end"
        />
      </div>

      {/* Layover detail pills */}
      {layovers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.2 }}
          style={{
            display:        'flex',
            flexWrap:       'wrap',
            gap:            6,
            marginBlockStart: 14,
          }}
        >
          {layovers.map((lay, i) => (
            <motion.div
              key={lay.code}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...SPRING, delay: 0.22 + i * 0.06 }}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            6,
                paddingBlock:   5, paddingInline: 10,
                borderRadius:   20,
                background:     `${AMBER}12`,
                border:         `1px solid ${AMBER}35`,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: AMBER,
                  boxShadow: `0 0 5px ${AMBER}cc`,
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontSize:      10,
                fontWeight:    700,
                color:         AMBER,
                fontFamily:    'inherit',
                letterSpacing: '-0.01em',
              }}>
                {lay.airport} ({lay.code})
              </span>
              <span style={{
                fontSize:   9.5,
                fontWeight: 600,
                color:      '#6E6E73',
                fontFamily: 'inherit',
              }}>
                {lay.durationLabel} layover
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
