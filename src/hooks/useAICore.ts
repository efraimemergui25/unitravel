'use client';

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useChat }                                  from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage }     from 'ai';
import { useRouter }                                from 'next/navigation';
import { useContextAwareness, buildScreenContext }  from '@/store/useContextAwareness';
import { useTravelEngine }                          from '@/store/useTravelEngine';
import { useUserDNA }                               from '@/store/useUserDNA';
import { applyDNAMutations }                        from '@/utils/DNAExtractor';
import type { UpdateDNAOutput }                     from '@/utils/DNAExtractor';
import { useNavigationStore }                       from '@/store/useNavigationStore';
import { useLocaleEngine }                          from '@/store/useLocaleEngine';
import type { AggregatedResult }                    from '@/services/OmniAggregator';

// Zone → route map
const ZONE_ROUTES: Record<string, string> = {
  flights:     '/zone/flights',
  lodging:     '/zone/lodging',
  dining:      '/zone/dining',
  attractions: '/zone/attractions',
  transit:     '/zone/transit',
};

export function useAICore(currentZone?: string) {
  const router      = useRouter();
  const { profile } = useLocaleEngine();
  const openZone    = useNavigationStore(s => s.openZone);

  // ── Trip context — reactive to store changes ────────────────────────────────
  const trip = useTravelEngine(s => ({
    tripTitle:   s.trip.title,
    destination: s.trip.id,
    startDate:   s.trip.startDate,
    endDate:     s.trip.endDate,
    travelers:   s.trip.travelers ?? [],
    budget:      s.budget,
    dnaProfile:  s.dnaProfile,
    activeDay:   s.activeDay,
  }));

  const awareness = useContextAwareness(s => ({
    activeZone:     s.activeZone,
    activeDayFocus: s.activeDayFocus,
    searchQuery:    s.searchQuery,
  }));

  // Build context snapshot; screenContext injected fresh per-send via ref below
  const tripContext = useMemo(() => ({
    tripTitle:    trip.tripTitle    ?? 'New Trip',
    destination:  trip.destination  ?? '',
    startDate:    trip.startDate    ?? '',
    endDate:      trip.endDate      ?? '',
    travelers:    trip.travelers,
    budget:       trip.budget,
    dnaProfile:   trip.dnaProfile,
    activeDay:    trip.activeDay    ?? awareness.activeDayFocus?.dayId ?? null,
    currentZone:  currentZone       ?? awareness.activeZone,
    locale:       profile.locale,
    currency:     profile.currency,
    screenContext: '',  // overwritten per-send
  }), [trip, awareness, currentZone, profile]);

  // Latest context ref — avoids stale closures; mutated synchronously before send
  const contextRef = useRef(tripContext);
  useEffect(() => { contextRef.current = tripContext; }, [tripContext]);

  // ── Transport — recreates only when key trip context changes ────────────────
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { context: tripContext } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip.destination, trip.startDate, trip.endDate, trip.budget?.total],
  );

  const { messages, sendMessage, stop, status } = useChat<UIMessage>({ transport });

  // ── Wrapped send — injects live screen context snapshot ────────────────────
  const send = useCallback(
    (content: string) => {
      sendMessage({
        role:  'user',
        parts: [{ type: 'text', text: content }],
      });
      // Patch transport body with fresh screen state on next micro-tick
      // (SDK reads body at request time — this arrives before the fetch)
      const fresh = { ...contextRef.current, screenContext: buildScreenContext() };
      Object.assign(
        (transport as unknown as { body: Record<string, unknown> }).body,
        { context: fresh },
      );
    },
    [sendMessage, transport],
  );

  // ── Tool invocation reactor ─────────────────────────────────────────────────
  const processed = useRef(new Set<string>());

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;

    for (const rawPart of (last.parts ?? [])) {
      if (rawPart.type !== 'tool-invocation') continue;
      const part = rawPart as unknown as { type: 'tool-invocation'; toolInvocation: { toolCallId: string; toolName: string; state: string; args: Record<string, unknown>; output?: unknown } };

      const inv  = part.toolInvocation;
      const key  = `${inv.toolCallId}:${inv.state}`;
      if (processed.current.has(key)) continue;
      processed.current.add(key);

      const { toolName, state } = inv;

      // ── Aviation Hub — open immediately when call is confirmed ────────────
      if (toolName === 'executeAviationSearch' && state === 'call') {
        openZone('flights');
        router.push(ZONE_ROUTES.flights);
      }

      // ── OmniSearch dispatcher — flip workspace to the correct zone ────────
      // Fires on 'call' (not 'output-available') so the zone opens before the
      // server finishes executing — the loading matrix starts immediately.
      if (toolName === 'triggerOmniSearch' && state === 'call') {
        const { targetZone } = inv.args as { targetZone: 'aviation' | 'lodging' };
        const zoneId = targetZone === 'aviation' ? 'flights' : 'hotels';
        const route  = targetZone === 'aviation' ? ZONE_ROUTES.flights : ZONE_ROUTES.lodging;
        openZone(zoneId as Parameters<typeof openZone>[0]);
        router.push(route);
      }

      // ── Generic zone navigation ───────────────────────────────────────────
      if (toolName === 'navigateWorkspace' && state === 'call') {
        const { zoneId } = inv.args as { zoneId: string };
        openZone(zoneId as Parameters<typeof openZone>[0]);
        if (ZONE_ROUTES[zoneId]) router.push(ZONE_ROUTES[zoneId]);
      }

      // ── Lodging commit — fires when server result is available ────────────
      if (toolName === 'commitLodgingToTimeline' && state === 'output-available') {
        const out = (inv as unknown as { output: Record<string, unknown> }).output;
        const store = useTravelEngine.getState();
        store.placeEntity(String(out.targetDay), {
          id:           String(out.sourceId ?? `hotel-${out.committedAt}`),
          category:     'hotel',
          sources:      ['ai-concierge'],
          sourceCount:  1,
          aiConfidence: 0.95,
          name:         String(out.hotelName),
          location:     '',
          destination:  trip.destination ?? '',
          tier:         'premium' as const,
          roomType:     String(out.roomType ?? 'Standard Room'),
          pricePerNight: Number(out.price),
          totalPrice:   Number(out.totalPrice),
          nights:       Number(out.nights ?? 1),
          rating:       0,
          reviewCount:  0,
          sentiment:    { positive: 0.8, neutral: 0.1, negative: 0.1, compound: 0.8 },
          amenities:    [],
          aiHighlight:  '',
          tags:         [],
        } as unknown as AggregatedResult);
        store.calculatePredictiveBudget();
      }

      // ── Hidden DNA update — fires silently, never surfaces in chat UI ────
      if (toolName === 'updateUserDNA' && state === 'output-available') {
        const out = (inv as unknown as { output: UpdateDNAOutput }).output;
        if (out?.mutations?.length) {
          const { mutateDNA } = useUserDNA.getState();
          applyDNAMutations(out.mutations, mutateDNA);
        }
      }

      // ── Minimal-schema entity commit (commitEntityToTimeline) ────────────
      if (toolName === 'commitEntityToTimeline' && state === 'output-available') {
        const out = (inv as unknown as { output: Record<string, unknown> }).output;
        const store = useTravelEngine.getState();
        store.placeEntity(String(out.targetDay), {
          id:          String(out.entityId),
          category:    String(out.category),
          sources:     ['ai-concierge'],
          sourceCount: 1,
          aiConfidence:0.95,
          title:       String(out.title),
          price:       Number(out.price),
        } as unknown as AggregatedResult);
        store.calculatePredictiveBudget();
      }

      // ── Generic entity commit ─────────────────────────────────────────────
      if (toolName === 'commitToTimeline' && state === 'output-available') {
        const out = (inv as unknown as { output: Record<string, unknown> }).output;
        const store = useTravelEngine.getState();
        store.placeEntity(String(out.targetDayId), {
          id:          String(out.entityId),
          category:    String(out.category),
          sources:     ['ai-concierge'],
          sourceCount: 1,
          aiConfidence:0.95,
          title:       String(out.title),
          subtitle:    String(out.subtitle),
          price:       Number(out.price),
        } as unknown as AggregatedResult);
        store.calculatePredictiveBudget();
      }
    }
  }, [messages, openZone, router, trip.destination]);

  return {
    messages,
    send,
    stop,
    status,
    isLoading: status === 'streaming' || status === 'submitted',
  };
}
