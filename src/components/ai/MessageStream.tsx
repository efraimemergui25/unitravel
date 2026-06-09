'use client';

import { useRef, useEffect }          from 'react';
import { motion, AnimatePresence }    from 'framer-motion';
import type { UIMessage }             from 'ai';
import { GlassShimmer }               from '@/components/ui/GlassShimmer';
import { GlassCard }                  from '@/components/ui/GlassCard';
import { ExecutionPill }              from './ExecutionPill';

// ── Animation config ──────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 340, damping: 30 } as const;

const BUBBLE_IN = {
  initial:    { opacity: 0, y: 10, scale: 0.97 },
  animate:    { opacity: 1, y: 0,  scale: 1    },
  exit:       { opacity: 0, y: -6, scale: 0.96 },
  transition: SPRING,
} as const;

// ── Tool label map ────────────────────────────────────────────────────────────

function toExecState(state: string): 'executing' | 'done' | 'error' {
  if (state === 'output-available')                          return 'done';
  if (state === 'output-error' || state === 'output-denied') return 'error';
  return 'executing';
}

// ── Tool invocation card ──────────────────────────────────────────────────────
// Physically expands inside the chat feed while a tool is executing

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

  const searchLabel =
    toolName === 'executeOmniSearch'
      ? 'Executing Omni-Search across 30 global engines...'
      : `Scanning aviation engines — ${String(args.origin ?? '')} → ${String(args.destination ?? '')}`;

  return (
    <motion.div
      layout
      {...BUBBLE_IN}
      // Audit: logical max-width, no physical left/right
      style={{ display: 'flex', flexDirection: 'column', gap: 8, maxInlineSize: '88%' }}
    >
      <ExecutionPill
        toolName={toolName}
        args={args}
        state={toExecState(state)}
        result={result}
      />

      {/* Physical expansion inside AI feed while tool runs */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            key="search-card"
            initial={{ opacity: 0, y: 8, scale: 0.97, height: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1,    height: 'auto' }}
            exit={{   opacity: 0, y: -4, scale: 0.96, height: 0 }}
            transition={SPRING}
            style={{ overflow: 'hidden' }}
          >
            {/* GlassCard with overlay GlassShimmer sweep — 60fps FM animation */}
            <GlassCard
              variant="light"
              className="relative px-4 py-3 text-sm font-medium text-slate-600 tracking-tight"
            >
              <GlassShimmer overlay />

              <span className="inline-flex items-center gap-1.5 mb-1.5">
                {[0, 0.14, 0.28].map((d, i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1, repeat: Infinity, delay: d, ease: 'easeInOut' }}
                  />
                ))}
              </span>

              {/* Gestalt-compliant line length */}
              <p style={{ maxWidth: '52ch', lineHeight: 1.625, margin: 0 }}>
                {searchLabel}
              </p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  // ── Audit-hardened bubble CSS ─────────────────────────────────────────────
  const bubbleClass = isUser
    // User: dark, high-contrast, inline-end aligned via ms-auto
    ? 'ms-auto max-w-[85%] p-4 mb-4 rounded-[1.5rem] rounded-tr-sm bg-slate-800 text-white shadow-md font-medium'
    // AI: frosted glass, inline-start, top-left corner square
    : 'me-auto max-w-[90%] p-4 mb-4 rounded-[1.5rem] rounded-tl-sm bg-white/40 backdrop-blur-3xl border border-white/60 text-slate-800 shadow-[0_4px_15px_rgba(0,0,0,0.02)]';

  const textContent = (message.parts ?? [])
    .filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('');

  const toolParts = ((message.parts ?? []) as unknown[]).filter(
    (p): p is {
      type:           'tool-invocation';
      toolInvocation: {
        toolCallId: string;
        toolName:   string;
        args:       Record<string, unknown>;
        state:      string;
        output?:    unknown;
      };
    } => (p as { type?: string }).type === 'tool-invocation',
  );

  return (
    // ── Audit: width:100% + logical ms-auto/me-auto on bubble replaces
    //    physical flex-end/flex-start on the container ──────────────────────
    <motion.div
      layout
      {...BUBBLE_IN}
      style={{
        display:       'flex',
        flexDirection: 'column',
        width:         '100%',
        gap:           8,
      }}
    >
      {/* Tool cards — rendered above text for AI messages */}
      {!isUser && toolParts.map(tp => (
        <ToolCard
          key={tp.toolInvocation.toolCallId}
          toolName={tp.toolInvocation.toolName}
          args={tp.toolInvocation.args ?? {}}
          state={tp.toolInvocation.state}
          result={tp.toolInvocation.output}
        />
      ))}

      {textContent.trim().length > 0 && (
        <div className={bubbleClass}>
          {/* ── Audit: leading-relaxed (1.625) + Gestalt 65ch line length ── */}
          <p
            style={{
              margin:        0,
              fontSize:      13.5,
              lineHeight:    1.625,           // leading-relaxed
              letterSpacing: '-0.01em',
              whiteSpace:    'pre-wrap',
              wordBreak:     'break-word',
              maxWidth:      '65ch',          // Gestalt-compliant line length
            }}
          >
            {textContent}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ── Thinking indicator — 60fps spring, no CSS keyframes ──────────────────────

function ThinkingIndicator() {
  return (
    <motion.div
      key="thinking"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        paddingBlock:   8,
        paddingInline:  14,
        borderRadius:   999,
        background:     'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border:         '1px solid rgba(255,255,255,0.80)',
        boxShadow:      '0 2px 12px rgba(31,38,135,0.04)',
        // Audit: logical alignment — inline-start side (left in LTR, right in RTL)
        marginInlineEnd: 'auto',
        maxInlineSize:   'fit-content',
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

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

        {isLoading && <ThinkingIndicator key="thinking" />}
      </AnimatePresence>

      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}
