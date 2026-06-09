import type { TransitQuery } from '@/types/transit';

// ── Transit Engine Adapter interface ──────────────────────────────────────────

export interface TransitSearchParams {
  origin:      string;
  destination: string;
  date?:       string;
  adults:      number;
}

export interface TransitEngineResult {
  engineId:      string;
  engineName:    string;
  status:        'ok' | 'needs_api_key' | 'error';
  results:       TransitQuery[];
  latencyMs:     number;
  deepLinkUrl?:  string;
  setupUrl?:     string;
  setupMessage?: string;
}

export interface TransitEngineAdapter {
  id:   string;
  name: string;
  search(params: TransitSearchParams): Promise<TransitEngineResult>;
}

// ── needs_api_key shell factory ───────────────────────────────────────────────

export function needsTransitKey(
  id: string, name: string, setupUrl: string, envVar: string,
  deepLinkFn?: (p: TransitSearchParams) => string,
): TransitEngineAdapter {
  return {
    id, name,
    async search(params) {
      return {
        engineId: id, engineName: name, status: 'needs_api_key',
        results: [], latencyMs: 0,
        deepLinkUrl: deepLinkFn ? deepLinkFn(params) : undefined,
        setupUrl, setupMessage: `Add ${envVar} to .env.local to enable ${name}.`,
      };
    },
  };
}
