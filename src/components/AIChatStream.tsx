'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage, DynamicToolUIPart } from 'ai';
import { useTravelEngine } from '@/store/useTravelEngine';
import { usePlanningBoard } from '@/store/usePlanningBoard';
import type { AggregatedFlight } from '@/services/OmniAggregator';

// ── Spring constants ──────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 400, damping: 30 } as const;
const SPRING_SOFT = { type: 'spring', stiffness: 380, damping: 32 } as const;

// ── Tool label map ────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  executeOmniSearch:    'Scanning 30 Global Networks...',
  mutateTimeline:       'Preparing timeline placement...',
  adjustFinancialModel: 'Recalibrating financial model...',
  adjustDNA:            'Updating your Travel DNA...',
};

// ── Category emojis ───────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  flight:    '✈️',
  hotel:     '🏨',
  restaurant:'🍽',
  activity:  '🎭',
  transport: '🚗',
};

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Find fastest flights to Tulum →',
  'Best Michelin restaurants in Mexico City →',
  'Optimize my budget →',
  'Plan perfect Day 3 →',
] as const;

// ── ToolPill — loading state ──────────────────────────────────────────────────

function ToolPill({ toolName }: { toolName: string }) {
  const label = TOOL_LABELS[toolName] ?? 'Processing...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={SPRING_SOFT}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(0,122,255,0.06)',
        border:     '1px solid rgba(0,122,255,0.15)',
        padding:    '12px 14px',
        maxWidth:   '320px',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        {/* Pulsing glow dot */}
        <motion.span
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display:         'inline-block',
            width:           8,
            height:          8,
            borderRadius:    '50%',
            background:      '#007AFF',
            flexShrink:      0,
          }}
        />
        {/* Animated braille-style spinner */}
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 14, color: '#007AFF', lineHeight: 1 }}
        >
          ⣿
        </motion.span>
        <span
          style={{
            fontSize:   13,
            fontWeight: 500,
            color:      '#1D1D1F',
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
      </div>

      {/* Shimmer progress bar */}
      <div
        style={{
          position:     'relative',
          height:       4,
          borderRadius: 2,
          overflow:     'hidden',
          background:   'rgba(0,122,255,0.10)',
        }}
      >
        <motion.div
          animate={{ x: ['-100%', '250%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position:           'absolute',
            insetBlockStart:    0,
            insetBlockEnd:      0,
            insetInlineStart:   0,
            width:              '40%',
            borderRadius:       2,
            background:         'linear-gradient(90deg, transparent, rgba(0,122,255,0.55), transparent)',
          }}
        />
      </div>
    </motion.div>
  );
}

// ── OmniSearch result mini card ────────────────────────────────────────────────

interface FlightCardProps {
  flight:     AggregatedFlight;
  onStage:    () => void;
  isStaged:   boolean;
}

function FlightMiniCard({ flight, onStage, isStaged }: FlightCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="rounded-xl shrink-0"
      style={{
        background:    'rgba(255,255,255,0.82)',
        backdropFilter:'blur(40px)',
        border:        '1px solid rgba(255,255,255,0.90)',
        boxShadow:     '0 4px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05)',
        padding:       '12px 14px',
        minWidth:      200,
        maxWidth:      240,
      }}
    >
      {/* Route + airline */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ fontSize: 14 }}>✈️</span>
        <span
          style={{
            fontSize:   12,
            fontWeight: 700,
            color:      '#1D1D1F',
            overflow:   'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {flight.airline}
        </span>
      </div>

      <p
        style={{
          fontSize:     12,
          fontWeight:   600,
          color:        '#007AFF',
          marginBlockEnd: 2,
        }}
      >
        {flight.route}
      </p>

      {/* Duration + stops */}
      <p style={{ fontSize: 11, color: '#6E6E73', marginBlockEnd: 6 }}>
        {flight.durationLabel} &middot; {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
      </p>

      {/* Price row */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F' }}>
          ${flight.price.toLocaleString()}
        </span>
        {/* AI confidence badge */}
        <span
          style={{
            fontSize:        10,
            fontWeight:      700,
            color:           '#007AFF',
            background:      'rgba(0,122,255,0.10)',
            border:          '1px solid rgba(0,122,255,0.20)',
            borderRadius:    999,
            paddingBlock:    1,
            paddingInline:   6,
          }}
        >
          {Math.round(flight.aiConfidence * 100)}%
        </span>
      </div>

      {/* Stage button */}
      <motion.button
        onClick={onStage}
        disabled={isStaged}
        whileHover={isStaged ? {} : { scale: 1.02 }}
        whileTap={isStaged ? {} : { scale: 0.97 }}
        transition={SPRING}
        style={{
          marginBlockStart: 10,
          width:            '100%',
          paddingBlock:     6,
          borderRadius:     8,
          fontSize:         11,
          fontWeight:       700,
          color:            isStaged ? '#6E6E73' : 'white',
          background:       isStaged
            ? 'rgba(0,0,0,0.06)'
            : 'linear-gradient(135deg, #007AFF, #5E5CE6)',
          border:           'none',
          cursor:           isStaged ? 'default' : 'pointer',
          transition:       'background 0.2s',
        }}
      >
        {isStaged ? '✓ Staged' : 'Stage'}
      </motion.button>
    </motion.div>
  );
}

// ── OmniSearch result row ─────────────────────────────────────────────────────

interface OmniSearchOutput {
  category:        string;
  results:         AggregatedFlight[];
  count:           number;
  sourcesQueried:  number;
  processingMs:    number;
}

function OmniSearchResult({ output }: { output: OmniSearchOutput }) {
  const { addToBoard, isStaged } = usePlanningBoard();
  const flights = output.results ?? [];

  return (
    <div style={{ marginBlockStart: 6 }}>
      {/* Summary header */}
      <p
        style={{
          fontSize:        11,
          color:           '#6E6E73',
          marginBlockEnd:  8,
        }}
      >
        {output.count} results from {output.sourcesQueried} sources &middot; {output.processingMs}ms
      </p>

      {/* Horizontal scroll row */}
      <div
        className="light-scroll"
        style={{
          display:        'flex',
          flexDirection:  'row',
          gap:            10,
          overflowX:      'auto',
          paddingBlockEnd: 4,
        }}
      >
        {flights.slice(0, 3).map((flight) => (
          <FlightMiniCard
            key={flight.id}
            flight={flight}
            onStage={() => addToBoard(flight)}
            isStaged={isStaged(flight.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Timeline placement result ─────────────────────────────────────────────────

interface MutateTimelineOutput {
  requiresConfirmation: boolean;
  entity: {
    dayId:    string;
    category: string;
    title:    string;
    subtitle: string;
    price:    number;
    time?:    string;
    reason:   string;
    sourceId?: string;
  };
  status: string;
}

function TimelineResult({ output }: { output: MutateTimelineOutput }) {
  const [placed, setPlaced] = useState(false);
  const entity = output.entity;

  const handlePlace = useCallback(() => {
    const { placeEntity, days } = useTravelEngine.getState();
    // Build a minimal AggregatedResult-compatible source for placeEntity
    // We need a flight-like shape; use entity details best we can
    const syntheticSource = {
      id:            entity.sourceId ?? `ai-placed-${Date.now()}`,
      category:      'flight' as const,
      airline:       entity.title,
      route:         entity.subtitle,
      price:         entity.price,
      departure:     entity.time ?? '10:00',
      durationMin:   0,
      durationLabel: '',
      stops:         0,
      class:         'Economy' as const,
      aiConfidence:  0.9,
      tags:          [],
      sourceCount:   1,
      sources:       ['AI'],
      origin:        '',
      destination:   '',
      arrival:       '',
      carbonKg:      0,
      carbonLabel:   '',
      carbonAlternative: '',
      priceRange:    [entity.price, entity.price] as [number, number],
      priceDropProbability: 0,
      seats:         0,
      refundable:    false,
      flightNumber:  '',
    };
    const targetDayId = entity.dayId;
    // Verify the day exists before placing
    if (days.some(d => d.id === targetDayId)) {
      placeEntity(targetDayId, syntheticSource);
    }
    setPlaced(true);
  }, [entity]);

  const dayNumber = entity.dayId.replace('day-', '');
  const catEmoji = CATEGORY_EMOJI[entity.category] ?? '📌';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SOFT}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(40px)',
        border:     placed
          ? '1px solid rgba(48,209,88,0.35)'
          : '1px solid rgba(0,122,255,0.20)',
        boxShadow:  '0 4px 16px rgba(0,0,0,0.07)',
        padding:    '14px 16px',
        maxWidth:   360,
      }}
    >
      <AnimatePresence mode="wait">
        {placed ? (
          <motion.div
            key="placed"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            className="flex items-center gap-2"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              style={{ fontSize: 18 }}
            >
              ✓
            </motion.span>
            <span
              style={{ fontSize: 13, fontWeight: 600, color: '#30D158' }}
            >
              Added to Day {dayNumber}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Entity header */}
            <div className="flex items-start gap-2 mb-2">
              <span style={{ fontSize: 18, flexShrink: 0 }}>{catEmoji}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>
                  {entity.title}
                </p>
                <p style={{ fontSize: 11, color: '#6E6E73' }}>
                  {entity.subtitle}
                </p>
              </div>
              <span
                style={{
                  marginInlineStart: 'auto',
                  fontSize:          14,
                  fontWeight:        800,
                  color:             '#1D1D1F',
                  flexShrink:        0,
                }}
              >
                ${entity.price.toLocaleString()}
              </span>
            </div>

            {/* AI reason */}
            <p
              style={{
                fontSize:       11,
                color:          '#6E6E73',
                marginBlockEnd: 12,
                lineHeight:     1.5,
              }}
            >
              {entity.reason}
            </p>

            {/* Action buttons */}
            <div className="flex gap-2">
              <motion.button
                onClick={handlePlace}
                whileHover={{ scale: 1.02, boxShadow: '0 6px 24px rgba(0,122,255,0.35)' }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                style={{
                  flex:         1,
                  paddingBlock: 8,
                  borderRadius: 10,
                  fontSize:     12,
                  fontWeight:   700,
                  color:        'white',
                  background:   'linear-gradient(135deg, #007AFF, #5E5CE6)',
                  border:       'none',
                  cursor:       'pointer',
                }}
              >
                ✓ Place on Timeline
              </motion.button>
              <motion.button
                onClick={() => setPlaced(true)}
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                style={{
                  paddingInline: 16,
                  paddingBlock:  8,
                  borderRadius:  10,
                  fontSize:      12,
                  fontWeight:    600,
                  color:         '#6E6E73',
                  background:    'rgba(0,0,0,0.05)',
                  border:        'none',
                  cursor:        'pointer',
                }}
              >
                Skip
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Financial model adjustment result ─────────────────────────────────────────

interface FinancialOutput {
  adjusted: boolean;
  params: {
    category: string;
    amount:   number;
    reason:   string;
    urgency:  string;
    dayId?:   string;
  };
  impact:  string;
  status:  string;
}

function FinancialResult({ output }: { output: FinancialOutput }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const isSaving = output.params.amount < 0;
  const absAmt   = Math.abs(output.params.amount);
  const catEmoji = CATEGORY_EMOJI[output.params.category] ?? '💰';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.25 } }}
          transition={SPRING}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            8,
            paddingBlock:   7,
            paddingInline:  14,
            borderRadius:   999,
            fontSize:       12,
            fontWeight:     600,
            background:     isSaving
              ? 'rgba(48,209,88,0.12)'
              : 'rgba(255,159,10,0.12)',
            border:         isSaving
              ? '1px solid rgba(48,209,88,0.30)'
              : '1px solid rgba(255,159,10,0.30)',
            color:          isSaving ? '#28A745' : '#C77800',
          }}
        >
          <span>{catEmoji}</span>
          <span>
            {isSaving ? '↓ Saving' : '↑ +'} ${absAmt.toLocaleString()}&nbsp;
            <span style={{ fontWeight: 400, opacity: 0.75 }}>
              &middot; {output.params.reason}
            </span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Travel DNA adjustment result ──────────────────────────────────────────────

interface DNAOutput {
  adjusted: boolean;
  field:    string;
  value:    number;
  reason:   string;
}

const DNA_FIELD_LABELS: Record<string, string> = {
  paceIndex:         'Pace',
  culinaryAffinity:  'Culinary',
  accommodationTier: 'Accommodation',
  experienceWeight:  'Experiences',
  flexibilityScore:  'Flexibility',
};

function DNAResult({ output }: { output: DNAOutput }) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;
    useTravelEngine.getState().patchDNA(output.field, output.value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pct   = Math.round(output.value * 100);
  const label = DNA_FIELD_LABELS[output.field] ?? output.field;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           8,
        paddingBlock:  7,
        paddingInline: 14,
        borderRadius:  999,
        fontSize:      12,
        fontWeight:    600,
        background:    'rgba(94,92,230,0.10)',
        border:        '1px solid rgba(94,92,230,0.28)',
        color:         '#5E5CE6',
      }}
    >
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ fontSize: 13 }}
      >
        ✦
      </motion.span>
      <span>
        Travel DNA updated · {label} → {pct}%
        <span style={{ fontWeight: 400, opacity: 0.72 }}>
          &nbsp;· {output.reason}
        </span>
      </span>
    </motion.div>
  );
}

// ── Tool part renderer ────────────────────────────────────────────────────────

function ToolPartView({ part }: { part: DynamicToolUIPart }) {
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return <ToolPill toolName={part.toolName} />;
  }

  if (part.state === 'output-available') {
    if (part.toolName === 'executeOmniSearch') {
      return (
        <OmniSearchResult
          output={part.output as OmniSearchOutput}
        />
      );
    }
    if (part.toolName === 'mutateTimeline') {
      return (
        <TimelineResult
          output={part.output as MutateTimelineOutput}
        />
      );
    }
    if (part.toolName === 'adjustFinancialModel') {
      return (
        <FinancialResult
          output={part.output as FinancialOutput}
        />
      );
    }
    if (part.toolName === 'adjustDNA') {
      return (
        <DNAResult
          output={part.output as DNAOutput}
        />
      );
    }
  }

  return null;
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING_SOFT}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    isUser ? 'flex-end' : 'flex-start',
        gap:           8,
      }}
    >
      {message.parts.map((part, i) => {
        // Skip step-start markers
        if (part.type === 'step-start') return null;

        if (part.type === 'text') {
          if (isUser) {
            return (
              <div
                key={i}
                style={{
                  background:         'linear-gradient(135deg, #007AFF, #5E5CE6)',
                  color:              'white',
                  borderRadius:       16,
                  borderEndEndRadius: 4,
                  padding:            '10px 14px',
                  maxWidth:           '72%',
                  fontSize:           14,
                  lineHeight:         1.5,
                  whiteSpace:         'pre-wrap',
                  wordBreak:          'break-word',
                }}
              >
                {part.text}
              </div>
            );
          }

          return (
            <p
              key={i}
              style={{
                fontSize:   14,
                color:      '#1D1D1F',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                maxWidth:   '88%',
                wordBreak:  'break-word',
              }}
            >
              {part.text}
            </p>
          );
        }

        if (part.type === 'dynamic-tool') {
          return (
            <div key={i}>
              <ToolPartView part={part as DynamicToolUIPart} />
            </div>
          );
        }

        return null;
      })}
    </motion.div>
  );
}

// ── Welcome card (empty state) ────────────────────────────────────────────────

function WelcomeCard({
  onSuggest,
}: {
  onSuggest: (text: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING_SOFT}
      className="flex flex-col items-center gap-6 py-8 px-4"
    >
      {/* ARIA logo pulse */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:        72,
          height:       72,
          borderRadius: 20,
          background:   'linear-gradient(135deg, rgba(0,122,255,0.14), rgba(94,92,230,0.14))',
          border:       '1px solid rgba(0,122,255,0.22)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     32,
          boxShadow:    '0 4px 24px rgba(0,122,255,0.15)',
        }}
      >
        ✦
      </motion.div>

      <div className="text-center flex flex-col gap-1">
        <h2
          style={{
            fontSize:   20,
            fontWeight: 800,
            color:      '#1D1D1F',
          }}
        >
          How can I help plan your trip?
        </h2>
        <p style={{ fontSize: 13, color: '#6E6E73' }}>
          Ask ARIA anything — flights, hotels, dining, budget
        </p>
      </div>

      {/* Suggestion chips */}
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          gap:            8,
          width:          '100%',
          maxWidth:       380,
        }}
      >
        {SUGGESTIONS.map((text) => (
          <motion.button
            key={text}
            onClick={() => onSuggest(text.replace(' →', ''))}
            whileHover={{ x: 3, boxShadow: '0 4px 20px rgba(0,122,255,0.12)' }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING}
            style={{
              textAlign:       'start',
              paddingBlock:    10,
              paddingInline:   14,
              borderRadius:    12,
              fontSize:        13,
              fontWeight:      500,
              color:           '#1D1D1F',
              background:      'rgba(255,255,255,0.82)',
              backdropFilter:  'blur(40px)',
              border:          '1px solid rgba(255,255,255,0.90)',
              boxShadow:       '0 2px 10px rgba(0,0,0,0.06)',
              cursor:          'pointer',
            }}
          >
            {text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <motion.span
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display:      'inline-block',
        width:        7,
        height:       7,
        borderRadius: '50%',
        background:   color,
        flexShrink:   0,
      }}
    />
  );
}

// ── AIChatStream ──────────────────────────────────────────────────────────────

export function AIChatStream() {
  const { trip, budget, dnaProfile, activeDay, days } = useTravelEngine();
  const { addToBoard } = usePlanningBoard();

  // Suppress unused-var warning — addToBoard is used via the store in sub-components,
  // but we also keep it available at the top-level scope as per spec.
  void addToBoard;

  // Build trip context for system prompt injection
  const buildContext = useCallback(() => ({
    tripTitle:   trip.title,
    travelers:   trip.travelers,
    destination: days.find(d => d.id === activeDay)?.destination ?? trip.title,
    startDate:   trip.startDate,
    endDate:     trip.endDate,
    budget: {
      total:        budget.total,
      spent:        budget.spent,
      burnRate:     budget.burnRate,
      projected:    budget.projected,
      overBudgetBy: budget.overBudgetBy,
    },
    dnaProfile:  dnaProfile,
    activeDay:   activeDay,
  }), [trip, budget, dnaProfile, activeDay, days]);

  // Keep context ref always current without causing transport re-creation
  const contextRef = useRef(buildContext());
  useEffect(() => {
    contextRef.current = buildContext();
  }, [buildContext]);

  // Stable transport — body is a function that reads from contextRef
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api:  '/api/concierge',
        body: () => contextRef.current,
      }),
    [], // intentionally empty — body is a closure over the ref
  );

  const { messages, sendMessage, status, stop } = useChat({ transport });

  // Local input state
  const [inputText, setInputText] = useState('');

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Textarea ref for auto-resize
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineH = 20;
    const maxH  = lineH * 4 + 24; // 4 rows + padding
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, [inputText]);

  // Determine if any tool call is currently scanning
  const isSearching = messages.some(msg =>
    msg.parts.some(
      p =>
        p.type === 'dynamic-tool' &&
        (p as DynamicToolUIPart).toolName === 'executeOmniSearch' &&
        ((p as DynamicToolUIPart).state === 'input-streaming' ||
          (p as DynamicToolUIPart).state === 'input-available'),
    ),
  );

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Status label + dot color
  const statusLabel = isSearching
    ? 'ARIA is searching...'
    : isStreaming
    ? 'ARIA is thinking...'
    : 'Ready';

  const dotColor = isSearching ? '#FF9F0A' : isStreaming ? '#007AFF' : '#30D158';

  const handleSubmit = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInputText('');
  }, [inputText, isStreaming, sendMessage]);

  const handleSuggest = useCallback(
    (text: string) => {
      if (isStreaming) return;
      sendMessage({ text });
    },
    [isStreaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center shrink-0 ps-4 pe-4"
        style={{
          height:         52,
          borderBlockEnd: '1px solid rgba(0,0,0,0.06)',
          gap:            8,
        }}
      >
        {/* ARIA logo mark */}
        <motion.span
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            fontSize:    16,
            background:  'linear-gradient(135deg, #007AFF, #5E5CE6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip:      'text',
            flexShrink:  0,
          }}
        >
          ✦
        </motion.span>

        <span
          style={{
            fontSize:   14,
            fontWeight: 700,
            color:      '#1D1D1F',
            flex:       1,
          }}
        >
          ARIA · AI Concierge
        </span>

        {/* Stop button while streaming */}
        <AnimatePresence>
          {isStreaming && (
            <motion.button
              key="stop"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={SPRING}
              onClick={stop}
              style={{
                paddingBlock:  5,
                paddingInline: 12,
                borderRadius:  999,
                fontSize:      11,
                fontWeight:    700,
                color:         '#FF3B30',
                background:    'rgba(255,59,48,0.09)',
                border:        '1px solid rgba(255,59,48,0.22)',
                cursor:        'pointer',
              }}
            >
              Stop
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Messages area ───────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto light-scroll"
        style={{ padding: '16px 16px 0' }}
      >
        <AnimatePresence>
          {messages.length === 0 ? (
            <WelcomeCard key="welcome" onSuggest={handleSuggest} />
          ) : (
            <div
              style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           16,
                paddingBlockEnd: 16,
              }}
            >
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0"
        style={{
          borderBlockStart: '1px solid rgba(0,0,0,0.06)',
          padding:          '10px 12px 12px',
        }}
      >
        {/* Status badge */}
        <div
          className="flex items-center gap-1.5"
          style={{ marginBlockEnd: 8 }}
        >
          <StatusDot color={dotColor} />
          <span style={{ fontSize: 11, color: '#6E6E73', fontWeight: 500 }}>
            {statusLabel}
          </span>
        </div>

        {/* Textarea + send/stop button row */}
        <div
          style={{
            display:        'flex',
            alignItems:     'flex-end',
            gap:            10,
            background:     'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(40px)',
            border:         '1px solid rgba(255,255,255,0.90)',
            borderRadius:   16,
            boxShadow:      '0 2px 12px rgba(0,0,0,0.06)',
            paddingBlock:   10,
            paddingInline:  14,
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ARIA anything about your trip..."
            rows={1}
            style={{
              flex:        1,
              resize:      'none',
              background:  'transparent',
              border:      'none',
              outline:     'none',
              fontSize:    14,
              lineHeight:  '20px',
              color:       '#1D1D1F',
              fontFamily:  'inherit',
              overflowY:   'hidden',
              paddingBlock: 0,
            }}
          />

          {/* Send / Stop button */}
          <motion.button
            onClick={isStreaming ? stop : handleSubmit}
            disabled={!isStreaming && !inputText.trim()}
            whileHover={
              isStreaming || inputText.trim()
                ? { scale: 1.08, boxShadow: '0 4px 20px rgba(0,122,255,0.45)' }
                : {}
            }
            whileTap={
              isStreaming || inputText.trim() ? { scale: 0.93 } : {}
            }
            transition={SPRING}
            style={{
              width:          36,
              height:         36,
              borderRadius:   '50%',
              flexShrink:     0,
              background:     isStreaming
                ? 'rgba(255,59,48,0.90)'
                : inputText.trim()
                ? 'linear-gradient(135deg, #007AFF, #5E5CE6)'
                : 'rgba(0,0,0,0.08)',
              border:         'none',
              cursor:         isStreaming || inputText.trim() ? 'pointer' : 'default',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          isStreaming || inputText.trim() ? 'white' : '#AEAEB2',
              fontSize:       16,
              fontWeight:     800,
              transition:     'background 0.2s',
            }}
            aria-label={isStreaming ? 'Stop' : 'Send'}
          >
            {isStreaming ? '■' : '↑'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default AIChatStream;
