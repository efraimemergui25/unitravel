'use client';

// useContextAwareness.ts — Real-time screen reader for the AI concierge.
// Tracks exactly what the user is looking at in the 2/3 workspace so the AI
// can resolve "the second one" or "that hotel" without clarification.

import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkspaceZone =
  | 'flights' | 'lodging' | 'dining' | 'attractions' | 'transit'
  | 'management' | 'map' | 'home';

export interface VisibleEntity {
  id:       string;
  index:    number;   // 0-based position in the visible list ("the second one" = index 1)
  category: string;
  title:    string;
  subtitle: string;
  price:    number;
  source?:  string;
}

export interface DayFocus {
  dayId:       string;
  dayNumber:   number;
  destination: string;
  date:        string;
}

interface ContextAwarenessState {
  activeZone:            WorkspaceZone;
  visibleEntities:       VisibleEntity[];
  focusedEntityIndex:    number | null;  // null = none hovered/focused
  activeDayFocus:        DayFocus | null;
  lastScrollPosition:    number;
  searchQuery:           string;

  setActiveZone:         (zone: WorkspaceZone) => void;
  setVisibleEntities:    (entities: VisibleEntity[]) => void;
  setFocusedEntity:      (index: number | null) => void;
  setDayFocus:           (day: DayFocus | null) => void;
  setScrollPosition:     (pos: number) => void;
  setSearchQuery:        (q: string) => void;
  clearVisibleEntities:  () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useContextAwareness = create<ContextAwarenessState>()(
  immer((set) => ({
    activeZone:         'home',
    visibleEntities:    [],
    focusedEntityIndex: null,
    activeDayFocus:     null,
    lastScrollPosition: 0,
    searchQuery:        '',

    setActiveZone:         (zone)    => set(s => { s.activeZone = zone; }),
    setVisibleEntities:    (entities) => set(s => { s.visibleEntities = entities; }),
    setFocusedEntity:      (index)   => set(s => { s.focusedEntityIndex = index; }),
    setDayFocus:           (day)     => set(s => { s.activeDayFocus = day; }),
    setScrollPosition:     (pos)     => set(s => { s.lastScrollPosition = pos; }),
    setSearchQuery:        (q)       => set(s => { s.searchQuery = q; }),
    clearVisibleEntities:  ()        => set(s => { s.visibleEntities = []; }),
  })),
);

// ── Screen context snapshot for AI system prompt ──────────────────────────────

export function buildScreenContext(): string {
  const s = useContextAwareness.getState();

  const zoneLine = `Active zone: ${s.activeZone}`;

  const entityLines = s.visibleEntities.length > 0
    ? 'Currently visible results (user can refer to these by ordinal):\n' +
      s.visibleEntities.slice(0, 8).map(e =>
        `  [${e.index + 1}] ${e.title} — ${e.subtitle} — $${e.price} (${e.category})`
      ).join('\n')
    : 'No search results currently visible.';

  const focusLine = s.focusedEntityIndex !== null
    ? `User is hovering over result #${s.focusedEntityIndex + 1}: "${s.visibleEntities[s.focusedEntityIndex]?.title ?? 'unknown'}"`
    : '';

  const dayLine = s.activeDayFocus
    ? `Active day: Day ${s.activeDayFocus.dayNumber} — ${s.activeDayFocus.destination} (${s.activeDayFocus.date})`
    : '';

  const queryLine = s.searchQuery ? `Last search: "${s.searchQuery}"` : '';

  return [zoneLine, entityLines, focusLine, dayLine, queryLine]
    .filter(Boolean)
    .join('\n');
}
