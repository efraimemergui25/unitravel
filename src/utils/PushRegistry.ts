export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBdn2lUmkASTjmKKHRLA';
// Demo key — generate production keys: npx web-push generate-vapid-keys

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth:   string;
  };
}

export interface PushInitResult {
  permission:       PushPermission;
  subscription:     PushSubscriptionPayload | null;
  serviceWorkerReg: ServiceWorkerRegistration | null;
}

// Convert URL-safe base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

function extractSubscriptionPayload(sub: PushSubscription): PushSubscriptionPayload {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  return { endpoint: json.endpoint, keys: json.keys };
}

export const PushRegistry = {
  isSupported(): boolean {
    return typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
  },

  async requestPermission(): Promise<PushPermission> {
    if (!PushRegistry.isSupported()) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    const result = await Notification.requestPermission();
    return result;
  },

  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return reg;
    } catch {
      return null;
    }
  },

  async getOrCreateSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscriptionPayload | null> {
    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) return extractSubscriptionPayload(existing);

      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: key,
      });
      return extractSubscriptionPayload(sub);
    } catch {
      return null;
    }
  },

  async unsubscribe(reg: ServiceWorkerRegistration): Promise<boolean> {
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      return true;
    } catch {
      return false;
    }
  },

  // Full initialization sequence: permission → SW registration → subscription
  async initialize(): Promise<PushInitResult> {
    if (!PushRegistry.isSupported()) {
      return { permission: 'unsupported', subscription: null, serviceWorkerReg: null };
    }

    const permission = await PushRegistry.requestPermission();
    if (permission !== 'granted') {
      return { permission, subscription: null, serviceWorkerReg: null };
    }

    const reg = await PushRegistry.registerServiceWorker();
    if (!reg) {
      return { permission, subscription: null, serviceWorkerReg: null };
    }

    const subscription = await PushRegistry.getOrCreateSubscription(reg);
    return { permission, subscription, serviceWorkerReg: reg };
  },

  // Trigger a local notification (fallback when app is open — bypasses server push)
  async showLocalNotification(payload: {
    title:               string;
    body:                string;
    tag?:                string;
    requireInteraction?: boolean;
    url?:                string;
  }): Promise<void> {
    if (!PushRegistry.isSupported() || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(payload.title, {
        body:               payload.body,
        icon:               '/favicon.ico',
        vibrate:            [120, 60, 120],
        tag:                payload.tag ?? 'unitravel',
        requireInteraction: payload.requireInteraction ?? false,
        data:               { url: payload.url ?? '/' },
      } as NotificationOptions);
    } catch {
      // Silently fail — notifications are enhancement, not critical path
    }
  },

  // In production, POST subscription data to your server
  // This is the integration point for a Node.js web-push backend
  async syncSubscriptionToServer(payload: PushSubscriptionPayload): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch {
      // Non-blocking — subscription still works locally
    }
  },
};
