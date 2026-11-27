import type { SignedDeviceGrantPayload, SignedDeviceSettingsPayload } from './apiClient';
import { getTodayDateKey } from './scoring';
import type { SubscriptionSettings, SubscriptionStatus, UserAccount } from '../types/behavior';

export const ADMIN_GMAIL_ALLOWLIST = [
  'nesmanagah53@gmail.com',
  's.mohamed1111111@gmail.com',
];

export type DurationPresetKey = 'week' | 'month' | '3months' | '6months' | 'year' | 'unlimited';

export const DURATION_PRESETS: { key: DurationPresetKey; label: string }[] = [
  { key: 'week', label: 'أسبوع' },
  { key: 'month', label: 'شهر' },
  { key: '3months', label: '3 أشهر' },
  { key: '6months', label: '6 أشهر' },
  { key: 'year', label: 'سنة' },
  { key: 'unlimited', label: 'مفتوح' },
];

export interface DeviceKnownUser {
  uid: string;
  email: string;
  displayName: string;
  lastLoginAt: string;
}

const DEVICE_USERS_KEY = 'bi_device_users_v1';
const DEVICE_GRANTS_KEY = 'bi_device_grants_v1';
const DEVICE_SETTINGS_KEY = 'bi_device_settings_v1';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_GMAIL_ALLOWLIST.includes(email.trim().toLowerCase());
}

export function getDeviceSummary(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  return 'Web';
}

export function recordDeviceUser(entry: { uid: string; email: string; displayName: string }) {
  if (typeof window === 'undefined' || !entry.uid || !entry.email) return;
  try {
    const existing = getDeviceUsers();
    const filtered = existing.filter((u) => u.uid !== entry.uid);
    const updated: DeviceKnownUser[] = [
      {
        uid: entry.uid,
        email: entry.email,
        displayName: entry.displayName || entry.email.split('@')[0] || 'مستخدم',
        lastLoginAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 30);
    window.localStorage.setItem(DEVICE_USERS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
}

export function getDeviceUsers(): DeviceKnownUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DEVICE_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u): u is DeviceKnownUser =>
        Boolean(u && typeof u.uid === 'string' && typeof u.email === 'string')
    );
  } catch {
    return [];
  }
}

export function saveDeviceGrantToken(uid: string, token: string) {
  if (typeof window === 'undefined' || !uid || !token) return;
  try {
    const map = getDeviceGrantTokenMap();
    map[uid] = token;
    window.localStorage.setItem(DEVICE_GRANTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getDeviceGrantTokenMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DEVICE_GRANTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function getDeviceGrantTokensList(): string[] {
  return Object.values(getDeviceGrantTokenMap()).filter((t): t is string => typeof t === 'string');
}

export function saveDeviceSettingsToken(token: string) {
  if (typeof window === 'undefined' || !token) return;
  try {
    window.localStorage.setItem(DEVICE_SETTINGS_KEY, token);
  } catch {
    // ignore
  }
}

export function getDeviceSettingsToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(DEVICE_SETTINGS_KEY) || '';
  } catch {
    return '';
  }
}

export function computeDateRangeForPreset(
  preset: DurationPresetKey,
  fromDateKey?: string
): { validFrom: string; validUntil: string; label: string } {
  const startKey = fromDateKey && /^\d{4}-\d{2}-\d{2}$/.test(fromDateKey)
    ? fromDateKey
    : getTodayDateKey();

  if (preset === 'unlimited') {
    return { validFrom: '', validUntil: '', label: 'مفتوح' };
  }

  const [y, m, d] = startKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  let label = 'شهر';

  if (preset === 'week') {
    dt.setDate(dt.getDate() + 7);
    label = 'أسبوع';
  } else if (preset === 'month') {
    dt.setMonth(dt.getMonth() + 1);
    label = 'شهر';
  } else if (preset === '3months') {
    dt.setMonth(dt.getMonth() + 3);
    label = '3 أشهر';
  } else if (preset === '6months') {
    dt.setMonth(dt.getMonth() + 6);
    label = '6 أشهر';
  } else if (preset === 'year') {
    dt.setFullYear(dt.getFullYear() + 1);
    label = 'سنة';
  }

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return {
    validFrom: startKey,
    validUntil: `${yyyy}-${mm}-${dd}`,
    label,
  };
}

export function sanitizeWhatsAppDigits(input?: string | null): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (!digits) return '';
  // Normalize Egyptian 01xxxxxxxxx local numbers to 201xxxxxxxxx
  if (digits.startsWith('01') && digits.length === 11) {
    digits = `2${digits}`;
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length < 8 || digits.length > 16) return '';
  return digits;
}

export function buildWhatsAppSupportUrl(params: {
  whatsappNumber?: string;
  userEmail?: string;
  displayName?: string;
  price?: number;
  currency?: string;
  reason?: string;
}): string {
  const digits = sanitizeWhatsAppDigits(params.whatsappNumber);
  if (!digits) return '';

  const priceLine =
    typeof params.price === 'number' && params.price > 0
      ? `\nقيمة الاشتراك الشهري: ${params.price} ${params.currency || 'ج.م'}`
      : '';
  const message = `السلام عليكم، أرجو تفعيل اشتراكي في تطبيق BEHAVIOR INSIGHT.\nالبريد الإلكتروني: ${params.userEmail || ''}\nالاسم: ${params.displayName || ''}${priceLine}${params.reason ? `\nالحالة: ${params.reason}` : ''}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export interface AccessEvaluationResult {
  allowed: boolean;
  reason: 'active' | 'admin' | 'suspended' | 'expired' | 'not_started';
  status: SubscriptionStatus;
  validFrom: string;
  validUntil: string;
  planLabel: string;
  effectivePrice: number;
}

function toTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof val === 'object') {
    const obj = val as { toMillis?: () => number; seconds?: number };
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
  }
  return 0;
}

export function evaluateSubscriptionAccess(params: {
  email?: string | null;
  account: UserAccount | null;
  deviceGrant: SignedDeviceGrantPayload | null;
  settings: SubscriptionSettings | SignedDeviceSettingsPayload | null;
}): AccessEvaluationResult {
  const defaultPrice = params.settings?.defaultMonthlyPrice ?? 0;

  if (isAdminEmail(params.email)) {
    return {
      allowed: true,
      reason: 'admin',
      status: 'active',
      validFrom: '',
      validUntil: '',
      planLabel: 'إدارة النظام',
      effectivePrice: 0,
    };
  }

  const acc = params.account;
  const grant = params.deviceGrant;

  const accHasSubFields = Boolean(
    acc &&
      (acc.subscriptionStatus !== undefined ||
        Boolean(acc.validFrom) ||
        Boolean(acc.validUntil) ||
        typeof acc.subscriptionPrice === 'number')
  );

  // Pick whichever source (Cloud Firestore or signed same-phone grant) is newer when both exist
  let status: SubscriptionStatus = 'active';
  let validFrom = '';
  let validUntil = '';
  let planLabel = '';
  let effectivePrice = defaultPrice;

  if (accHasSubFields && grant) {
    const accTime = toTimestampMs(acc?.updatedAt);
    const grantTime = toTimestampMs(grant.updatedAt);
    if (grantTime >= accTime) {
      status = grant.subscriptionStatus;
      validFrom = grant.validFrom || '';
      validUntil = grant.validUntil || '';
      planLabel = grant.subscriptionPlanLabel || '';
      effectivePrice = grant.subscriptionPrice > 0 ? grant.subscriptionPrice : defaultPrice;
    } else {
      status = acc?.subscriptionStatus === 'suspended' ? 'suspended' : 'active';
      validFrom = acc?.validFrom || '';
      validUntil = acc?.validUntil || '';
      planLabel = acc?.subscriptionPlanLabel || '';
      effectivePrice =
        typeof acc?.subscriptionPrice === 'number' && acc.subscriptionPrice > 0
          ? acc.subscriptionPrice
          : defaultPrice;
    }
  } else if (grant) {
    status = grant.subscriptionStatus;
    validFrom = grant.validFrom || '';
    validUntil = grant.validUntil || '';
    planLabel = grant.subscriptionPlanLabel || '';
    effectivePrice = grant.subscriptionPrice > 0 ? grant.subscriptionPrice : defaultPrice;
  } else if (acc) {
    status = acc.subscriptionStatus === 'suspended' ? 'suspended' : 'active';
    validFrom = acc.validFrom || '';
    validUntil = acc.validUntil || '';
    planLabel = acc.subscriptionPlanLabel || '';
    effectivePrice =
      typeof acc.subscriptionPrice === 'number' && acc.subscriptionPrice > 0
        ? acc.subscriptionPrice
        : defaultPrice;
  }

  if (status === 'suspended') {
    return {
      allowed: false,
      reason: 'suspended',
      status,
      validFrom,
      validUntil,
      planLabel,
      effectivePrice,
    };
  }

  const today = getTodayDateKey();
  if (validFrom && /^\d{4}-\d{2}-\d{2}$/.test(validFrom) && today < validFrom) {
    return {
      allowed: false,
      reason: 'not_started',
      status,
      validFrom,
      validUntil,
      planLabel,
      effectivePrice,
    };
  }
  if (validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) && today > validUntil) {
    return {
      allowed: false,
      reason: 'expired',
      status,
      validFrom,
      validUntil,
      planLabel,
      effectivePrice,
    };
  }

  return {
    allowed: true,
    reason: 'active',
    status,
    validFrom,
    validUntil,
    planLabel,
    effectivePrice,
  };
}
