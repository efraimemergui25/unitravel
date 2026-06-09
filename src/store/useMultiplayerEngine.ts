'use client';

import { create }             from 'zustand';
import { immer }              from 'zustand/middleware/immer';
import { getSupabaseClient }  from '@/lib/supabaseClient';
import { useTravelEngine }    from '@/store/useTravelEngine';
import type { PlacedEntity }  from '@/store/useTravelEngine';

// ── Peer color palette (Apple-spectrum) ───────────────────────────────────────

const PEER_COLORS = [
  '#FF453A', '#FF9F0A', '#30D158', '#00C7BE',
  '#007AFF', '#5E5CE6', '#BF5AF2', '#FF2D55',
];

function randomColor(): string {
  return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)] ?? '#007AFF';
}

let _myId:    string | null = null;
let _myColor: string | null = null;

function getMyId(): string {
  if (!_myId) {
    try { _myId = crypto.randomUUID(); }
    catch { _myId = `peer-${Date.now().toString(36)}`; }
  }
  return _myId;
}

function getMyColor(): string {
  if (!_myColor) _myColor = randomColor();
  return _myColor;
}

// ── Timeline mutation payload ─────────────────────────────────────────────────

export interface TimelineMutationPayload {
  peerId:      string;
  peerName:    string;
  action:      'place_entity' | 'remove_entity' | 'toggle_booked';
  targetDayId: string;
  entityId:    string;
  entityData?: PlacedEntity; // full entity for place_entity
}

// ── Message protocol ──────────────────────────────────────────────────────────

export type MultiplayerMessage =
  | { type: 'cursor';             peerId: string; displayName: string; color: string; x: number; y: number }
  | { type: 'typing';             peerId: string; displayName: string; color: string; isTypingAI: boolean }
  | { type: 'entity';             peerId: string; displayName: string; dayId: string; entityTitle: string; entityTime?: string }
  | { type: 'timeline_mutation';  payload: TimelineMutationPayload }
  | { type: 'heartbeat';          peerId: string; displayName: string; color: string }
  | { type: 'disconnect';         peerId: string };

// ── Peer state ────────────────────────────────────────────────────────────────

export interface MultiplayerPeer {
  id:          string;
  displayName: string;
  color:       string;
  cursor:      { x: number; y: number } | null;
  isTypingAI:  boolean;
  lastSeen:    number;
}

export interface TimelineConflict {
  id:          string;
  dayId:       string;
  peerName:    string;
  entityTitle: string;
  resolvedAt?: number;
}

// ── Store types ───────────────────────────────────────────────────────────────

interface MultiplayerState {
  myId:        string;
  myColor:     string;
  displayName: string;
  peers:       Record<string, MultiplayerPeer>;
  conflicts:   TimelineConflict[];
  isConnected: boolean;
  peerCount:   number;

  setDisplayName:           (name: string) => void;
  // Primary actions
  broadcastPointer:         (x: number, y: number) => void; // spec alias
  broadcastCursor:          (x: number, y: number) => void; // legacy alias
  broadcastTyping:          (isTypingAI: boolean) => void;
  broadcastEntity:          (dayId: string, entityTitle: string, entityTime?: string) => void;
  broadcastTimelineMutation:(payload: Omit<TimelineMutationPayload, 'peerId' | 'peerName'>) => void;
  resolveConflict:          (id: string) => void;
  connect:                  () => void;
  disconnect:               () => void;
}

// ── Transport singletons ──────────────────────────────────────────────────────

let _bcChannel:        BroadcastChannel | null  = null;
let _supabaseChannel:  ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const BC_CHANNEL_NAME  = 'unitravel-multiplayer';
const PEER_TIMEOUT_MS  = 12_000;

function getBCChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!_bcChannel) _bcChannel = new BroadcastChannel(BC_CHANNEL_NAME);
  return _bcChannel;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMultiplayerEngine = create<MultiplayerState>()(
  immer((set, get) => {

    // ── Send helpers (BroadcastChannel + Supabase Realtime) ───────────────

    const bcSend = (msg: MultiplayerMessage) => {
      try { getBCChannel()?.postMessage(msg); } catch { /* SSR / unsupported */ }
    };

    const rtSend = (event: string, payload: unknown) => {
      try {
        _supabaseChannel?.send({ type: 'broadcast', event, payload });
      } catch { /* offline */ }
    };

    const broadcast = (msg: MultiplayerMessage) => {
      bcSend(msg);
      // Mirror to Supabase Realtime
      if (msg.type === 'cursor') {
        rtSend('cursor', msg);
      } else if (msg.type === 'timeline_mutation') {
        rtSend('timeline_mutation', msg.payload);
      }
    };

    // ── Stale peer pruning ─────────────────────────────────────────────────

    const pruneStale = () => {
      set(s => {
        const now = Date.now();
        for (const id of Object.keys(s.peers)) {
          if (now - (s.peers[id]?.lastSeen ?? 0) > PEER_TIMEOUT_MS) {
            delete s.peers[id];
          }
        }
        s.peerCount = Object.keys(s.peers).length;
      });
    };

    // ── Apply incoming timeline mutation to local store ────────────────────

    const applyTimelineMutation = (payload: TimelineMutationPayload) => {
      if (payload.peerId === getMyId()) return; // ignore own echo
      const engine = useTravelEngine.getState();

      if (payload.action === 'place_entity' && payload.entityData) {
        // placeEntity only converts AggregatedResult → PlacedEntity.
        // For peer-broadcast entities that are already PlacedEntity, use
        // reorderDayEntities (which accepts PlacedEntity[]) + budget recalc.
        const day = engine.days.find(d => d.id === payload.targetDayId);
        if (day && !day.entities.find(e => e.id === payload.entityData!.id)) {
          engine.reorderDayEntities(payload.targetDayId, [...day.entities, payload.entityData!]);
          engine.calculatePredictiveBudget();
        }
      } else if (payload.action === 'remove_entity') {
        engine.removeEntity(payload.targetDayId, payload.entityId);
      } else if (payload.action === 'toggle_booked') {
        engine.toggleBooked(payload.targetDayId, payload.entityId);
      }
    };

    // ── BroadcastChannel message handler ──────────────────────────────────

    const handleBCMessage = (e: MessageEvent<MultiplayerMessage>) => {
      const msg = e.data;
      if (!msg) return;
      handleAnyMessage(msg);
    };

    // ── Unified message handler ────────────────────────────────────────────

    const handleAnyMessage = (msg: MultiplayerMessage) => {
      if ('peerId' in msg && msg.peerId === getMyId()) return;

      switch (msg.type) {
        case 'cursor':
          set(s => {
            if (!s.peers[msg.peerId]) {
              s.peers[msg.peerId] = {
                id: msg.peerId, displayName: msg.displayName, color: msg.color,
                cursor: null, isTypingAI: false, lastSeen: Date.now(),
              };
            }
            const peer = s.peers[msg.peerId];
            if (peer) {
              peer.cursor      = { x: msg.x, y: msg.y };
              peer.lastSeen    = Date.now();
              peer.displayName = msg.displayName;
              peer.color       = msg.color;
            }
            s.peerCount = Object.keys(s.peers).length;
          });
          break;

        case 'typing':
          set(s => {
            if (!s.peers[msg.peerId]) {
              s.peers[msg.peerId] = {
                id: msg.peerId, displayName: msg.displayName, color: msg.color,
                cursor: null, isTypingAI: false, lastSeen: Date.now(),
              };
            }
            const peer = s.peers[msg.peerId];
            if (peer) {
              peer.isTypingAI  = msg.isTypingAI;
              peer.lastSeen    = Date.now();
              peer.displayName = msg.displayName;
            }
            s.peerCount = Object.keys(s.peers).length;
          });
          break;

        case 'timeline_mutation':
          applyTimelineMutation(msg.payload);
          break;

        case 'entity': {
          const state = get();
          const hasConflict = Object.values(state.peers).some(
            p => p.id !== msg.peerId && p.lastSeen > Date.now() - 3000,
          );
          if (hasConflict) {
            const conflictId = `conflict-${Date.now()}`;
            set(s => {
              s.conflicts.push({
                id:          conflictId,
                dayId:       msg.dayId,
                peerName:    msg.displayName,
                entityTitle: msg.entityTitle,
              });
            });
            setTimeout(() => get().resolveConflict(conflictId), 5000);
          }
          set(s => {
            const peer = s.peers[msg.peerId];
            if (peer) peer.lastSeen = Date.now();
          });
          break;
        }

        case 'heartbeat':
          set(s => {
            if (!s.peers[msg.peerId]) {
              s.peers[msg.peerId] = {
                id: msg.peerId, displayName: msg.displayName, color: msg.color,
                cursor: null, isTypingAI: false, lastSeen: Date.now(),
              };
            } else {
              const peer = s.peers[msg.peerId];
              if (peer) {
                peer.lastSeen    = Date.now();
                peer.displayName = msg.displayName;
                peer.color       = msg.color;
              }
            }
            s.peerCount = Object.keys(s.peers).length;
          });
          break;

        case 'disconnect':
          set(s => {
            delete s.peers[msg.peerId];
            s.peerCount = Object.keys(s.peers).length;
          });
          break;
      }
    };

    // ── Store definition ───────────────────────────────────────────────────

    return {
      myId:        getMyId(),
      myColor:     getMyColor(),
      displayName: 'Co-Planner',
      peers:       {},
      conflicts:   [],
      isConnected: false,
      peerCount:   0,

      setDisplayName: (name) => set(s => { s.displayName = name; }),

      broadcastPointer: (x, y) => {
        const { myId, myColor, displayName } = get();
        broadcast({ type: 'cursor', peerId: myId, displayName, color: myColor, x, y });
      },

      broadcastCursor: (x, y) => get().broadcastPointer(x, y),

      broadcastTyping: (isTypingAI) => {
        const { myId, myColor, displayName } = get();
        broadcast({ type: 'typing', peerId: myId, displayName, color: myColor, isTypingAI });
      },

      broadcastEntity: (dayId, entityTitle, entityTime) => {
        const { myId, displayName } = get();
        broadcast({ type: 'entity', peerId: myId, displayName, dayId, entityTitle, entityTime });
      },

      broadcastTimelineMutation: (partial) => {
        const { myId, displayName } = get();
        const payload: TimelineMutationPayload = { ...partial, peerId: myId, peerName: displayName };
        broadcast({ type: 'timeline_mutation', payload });
      },

      resolveConflict: (id) => {
        set(s => {
          const conflict = s.conflicts.find(c => c.id === id);
          if (conflict) conflict.resolvedAt = Date.now();
          setTimeout(() => {
            set(ss => { ss.conflicts = ss.conflicts.filter(c => c.id !== id); });
          }, 1200);
        });
      },

      connect: () => {
        // ── BroadcastChannel (same-origin cross-tab) ───────────────────────
        const bc = getBCChannel();
        if (bc) bc.onmessage = handleBCMessage;

        // ── Supabase Realtime (cross-device, room_trip_id) ─────────────────
        const supabase = getSupabaseClient();
        if (supabase) {
          const tripId      = useTravelEngine.getState().trip.id || 'default';
          const channelName = `room_${tripId}`;

          _supabaseChannel = supabase.channel(channelName, {
            config: { broadcast: { self: false }, presence: { key: getMyId() } },
          });

          _supabaseChannel
            .on('broadcast', { event: 'cursor' }, ({ payload }) => {
              handleAnyMessage({ type: 'cursor', ...payload } as MultiplayerMessage);
            })
            .on('broadcast', { event: 'timeline_mutation' }, ({ payload }) => {
              handleAnyMessage({ type: 'timeline_mutation', payload } as MultiplayerMessage);
            })
            .on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
              handleAnyMessage({ type: 'heartbeat', ...payload } as MultiplayerMessage);
            })
            .on('broadcast', { event: 'disconnect' }, ({ payload }) => {
              handleAnyMessage({ type: 'disconnect', ...payload } as MultiplayerMessage);
            })
            .subscribe();
        }

        set(s => { s.isConnected = true; });

        // Announce presence + start heartbeat
        const { myId, myColor, displayName } = get();
        broadcast({ type: 'heartbeat', peerId: myId, displayName, color: myColor });

        _heartbeatInterval = setInterval(() => {
          const state = get();
          broadcast({ type: 'heartbeat', peerId: state.myId, displayName: state.displayName, color: state.myColor });
          pruneStale();
        }, 5_000);

        if (typeof window !== 'undefined') {
          window.addEventListener('beforeunload', () => {
            broadcast({ type: 'disconnect', peerId: myId });
          }, { once: true });
        }
      },

      disconnect: () => {
        const { myId } = get();
        broadcast({ type: 'disconnect', peerId: myId });
        if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
        _bcChannel?.close(); _bcChannel = null;
        _supabaseChannel?.unsubscribe(); _supabaseChannel = null;
        set(s => { s.isConnected = false; s.peers = {}; s.peerCount = 0; });
      },
    };
  }),
);
