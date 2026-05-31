'use client';

import { create } from 'zustand';
import type { CrisisEvent } from '@/services/CrisisManager';

interface ToastStore {
  toasts:       CrisisEvent[];
  addToast:     (event: CrisisEvent) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast:     (event) => set(s => ({ toasts: [event, ...s.toasts].slice(0, 4) })),
  dismissToast: (id)    => set(s => ({ toasts: s.toasts.filter(t => t.id !== id)  })),
}));
