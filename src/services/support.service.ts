// ═══════════════════════════════════════════════════════════════════════════
// SupportService — configurable support contact (WhatsApp + Email).
// Direct port of desktop `_loadSupportWhatsApp` / `_formatSupportNumber`.
//
// The real number/email are fetched at runtime from the backend
// (GET /api/app-config → { success, supportWhatsapp, supportEmail }), which
// reads them from env vars — so they can be changed anytime without a new build.
// This is resilient: last-known-good values are cached (survive restarts) and a
// hardcoded fallback is used if the API is unavailable, so the WhatsApp/Email
// actions ALWAYS work (even offline or if the endpoint doesn't exist yet).
// ═══════════════════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/api';

// Fallbacks (same defaults as desktop) — used until backend provides real values.
const FALLBACK_WHATSAPP = '919999999999';
const FALLBACK_EMAIL = 'support@codingkida.com';

const WA_KEY = 'ck_support_whatsapp';
const EMAIL_KEY = 'ck_support_email';

// In-memory cache (read synchronously by screens after load()).
let _whatsapp = FALLBACK_WHATSAPP;
let _email = FALLBACK_EMAIL;
let _loaded = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export interface SupportContact {
  whatsapp: string;   // digits only, e.g. "919876543210"
  email: string;
  whatsappPretty: string; // formatted, e.g. "+91 98765 43210"
}

/** Format raw digits into a readable +CC number (best-effort). */
export function formatSupportNumber(num: string): string {
  const d = ('' + num).replace(/[^0-9]/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) {
    return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
  }
  return '+' + d;
}

export const SupportService = {
  /** Current values (in-memory). Safe to call before load() — returns fallback. */
  get(): SupportContact {
    return { whatsapp: _whatsapp, email: _email, whatsappPretty: formatSupportNumber(_whatsapp) };
  },

  /** Subscribe to updates (e.g. when the backend value arrives). Returns unsub. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /**
   * Load cached values immediately, then refresh from /api/app-config in the
   * background. Never throws — falls back to cached / hardcoded values.
   */
  async load(): Promise<void> {
    // 1) Cached (last-known-good) — instant, survives restarts.
    try {
      const cachedWa = await AsyncStorage.getItem(WA_KEY);
      if (cachedWa && /^[0-9]{6,}$/.test(cachedWa)) _whatsapp = cachedWa;
      const cachedEmail = await AsyncStorage.getItem(EMAIL_KEY);
      if (cachedEmail && /.+@.+\..+/.test(cachedEmail)) _email = cachedEmail;
    } catch {
      // ignore — keep fallback
    }
    _loaded = true;
    emit();

    // 2) Background refresh from backend (silent on failure).
    try {
      const res = await apiClient.get<{ success: boolean; supportWhatsapp?: string; supportEmail?: string }>('/api/app-config');
      const data = res.data;
      if (!data || !data.success) return;
      const num = ('' + (data.supportWhatsapp || '')).replace(/[^0-9]/g, '');
      if (num.length >= 6) {
        _whatsapp = num;
        try { await AsyncStorage.setItem(WA_KEY, num); } catch {}
      }
      const email = ('' + (data.supportEmail || '')).trim();
      if (/.+@.+\..+/.test(email)) {
        _email = email;
        try { await AsyncStorage.setItem(EMAIL_KEY, email); } catch {}
      }
      emit();
    } catch {
      // keep fallback / cached value
    }
  },

  get isLoaded(): boolean {
    return _loaded;
  },
};
