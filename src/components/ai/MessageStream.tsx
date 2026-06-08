'use client';

import { useRef, useEffect }          from 'react';
import { motion, AnimatePresence }    from 'framer-motion';
import type { UIMessage }             from 'ai';
import { GlassShimmer }               from '@/components/ui/GlassShimmer';
import { ExecutionPill }              from './ExecutionPill';

// ── Animation config ──────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 340, damping: 30 } as const;

const BUBBLE_IN = {
  initial:    { opacity: 0, y: 10, scale: 0.97 },
  animate:    { opacity: 1, y: 0,  scale: 1 },
  exit:       { opacity: 0, y: -6, scale: 0.96 },
  transition: SPRING,
} as const;

// ── Tool label map ────────────────────────────────────────────────────────────

function toolLabel(name: string, args: Record<string, unknown>): string {
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  switch (name) {
    case 'executeAviationSearch':
      return `Scanning aviation engines — ${String(args.origin ?? '')} → ${String(args.destination ?? '')}`;
    case 'commitLodgingToTimeline':
      return `Booking ${String(args.hotelName ?? 'hotel')} → Day ${String(args.targetDay ?? '')}`;
    case 'navigateWorkspace':
      return `Opening ${cap(String(args.zoneId ?? ''))} Hub`;
    case 'executeOmniSearch':
      return `Scanning 30 engines — ${String(args.origin ?? args.destination ?? '')}`;
    case 'commitToTimeline':
      return `Committing "${String(args.title ?? '')}" to timeline`;
    case 'mutateTimeline':
      return `Placing "${String(args.title ?? '')}" for review`;
    case 'adjustFinancialModel':
      return 'Updating budget forecast';
    case 'adjustDNA':
      return 'Calibrating Travel DNA';
    default:
      return cap(name.replace(/([A-Z])/g, ' $1').trim());
  }
}

function toExecState(state: string): 'executing' | 'done' | 'error' {
  if (state === 'output-available')                        return 'done';
  if (state === 'output-error' || state === 'output-denied') return 'error';
  return 'executing';
}

// ── Tool invocation card ──────────────────────────────────────────────────────

function ToolCard({
  toolName,
  args,
  state,
  result,
}: {
  toolName: string;
  args:     Record<string, unknown>;
  state:    string;
  result?:  unknown;
}) {
  const isSearching = (
    toolName === 'executeAviationSearch' ||
    toolName === 'executeOmniSearch'
  ) && state !== 'output-available';

  return (
    <motion.div
      layout
      {...BUBBLE_IN}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, maxInlineSize: '88%' }}
    >
      <ExecutionPill
        toolName={toolName}
        args={args}
        state={toExecState(state)}
        result={result}
      />

      {/* GlassShimmer skeleton while aviation search is in-flight */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            key="shimmer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 122 }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
            style={{ borderRadius: 18, overflow: 'hidden' }}
          >
            <GlassShimmer variant="hero-card" height={122} style={{ borderRadius: 18 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  // Exact CSS dictated — Tailwind logical properties for LTR/RTL
  const bubbleClass = isUser
    ? 'max-w-[85%] ms-auto p-4 rounded-[1.5rem] rounded-te-none bg-white/60 backdrop-blur-md border border-white/80 text-slate-800 shadow-sm'
    : 'max-w-[85%] me-auto p-4 rounded-[1.5rem] rounded-ts-none bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-900 shadow-sm';

  // Collect text content from parts
  const textContent = (message.parts ?? [])
    .filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('');

  // Collect tool invocations
  const toolParts = (message.parts ?? []).filter(
    p => p.type === 'tool-invocation',
  ) as Array<{
    type:            'tool-invocation';
    toolInvocation:  {
      toolCallId: string;
      toolName:   string;
      args:       Record<string, unknown>;
      state:      string;
      output?:    unknown;
    };
  }>;

  return (
    <motion.div
      layout
      {...BUBBLE_IN}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    isUser ? 'flex-end' : 'flex-start',
        gap:           8,
      }}
    >
      {/* Tool invocation cards — rendered above the text bubble for AI messages */}
      {!isUser && toolParts.map(tp => (
        <ToolCard
          key={tp.toolInvocation.toolCallId}
          toolName={tp.toolInvocation.toolName}
          args={tp.toolInvocation.args ?? {}}
          state={tp.toolInvocation.state}
          result={tp.toolInvocation.output}
        />
      ))}

      {/* Text bubble — only rendered when there is text */}
      {textContent.trim().length > 0 && (
        <div className={bubbleClass}>
          <p
            style={{
              fontSize:      13.5,
              lineHeight:    1.55,
              letterSpacing: '-0.01em',
              whiteSpace:    'pre-wrap',
              wordBreak:     'break-word',
            }}
          >
            {textContent}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ── Loading indicator ─────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <motion.div
      key="thinking"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={SPRING}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           6,
        paddingBlock:  8,
        paddingInline: 14,
        borderRadius:  999,
        background:    'rgba(255,255,255,0.60)',
        backdropFilter:'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border:        '1px solid rgba(255,255,255,0.80)',
        boxShadow:     '0 2px 12px rgba(31,38,135,0.04)',
        alignSelf:     'flex-start',
        maxInlineSize: 'fit-content',
      }}
    >
      {[0, 0.18, 0.36].map((delay, i) => (
        <motion.span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#007AFF', display: 'inline-block',
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 1.1, repeat: Infinity, delay, ease: 'easeInOut' }}
        />
      ))}
    </motion.div>
  );
}

// ── MessageStream ─────────────────────────────────────────────────────────────

export interface MessageStreamProps {
  messages:  UIMessage[];
  isLoading: boolean;
}

export function MessageStream({ messages, isLoading }: MessageStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  // Filter out the intro message from render (it's shown in the panel header)
  const visibleMessages = messages.filter(m => m.id !== 'aria-intro');

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        gap:            12,
        paddingBlock:   16,
        paddingInline:  14,
        overflowY:      'auto',
        flex:           1,
        minBlockSize:   0,
        scrollbarWidth: 'none',
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visibleMessages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <ThinkingIndicator key="thinking" />
        )}
      </AnimatePresence>

      {/* Scroll anchor */}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}
