'use client';

import { create } from 'zustand';
import type { AggregatedResult } from '@/services/OmniAggregator';

export interface StagedEntity {
  id:       string;   // unique staging ID
  source:   AggregatedResult;
  stagedAt: number;
}

interface PlanningBoardState {
  staged: StagedEntity[];
}

interface PlanningBoardActions {
  addToBoard:      (source: AggregatedResult) => void;
  removeFromBoard: (id: string) => void;
  clearBoard:      () => void;
  isStaged:        (sourceId: string) => boolean;
}

export const usePlanningBoard = create<PlanningBoardState & PlanningBoardActions>()((set, get) => ({
  staged: [],

  addToBoard: (source) => set(s => {
    // Prevent duplicate staging of the same source
    if (s.staged.some(e => e.source.id === source.id)) return s;
    return {
      staged: [...s.staged, {
        id:       `staged-${source.id}-${Date.now()}`,
        source,
        stagedAt: Date.now(),
      }],
    };
  }),

  removeFromBoard: (id) => set(s => ({
    staged: s.staged.filter(e => e.id !== id),
  })),

  clearBoard: () => set({ staged: [] }),

  isStaged: (sourceId) => get().staged.some(e => e.source.id === sourceId),
}));
