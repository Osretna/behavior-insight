import { auth } from './firebase';
import { inferCalculationMethod, resolveKnownLocation } from './locations';
import type { PrayerTimesResponse } from '../types/behavior';

async function getBearerHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('يرجى تسجيل الدخول أولاً.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonSafely<T>(res: Response, fallbackMsg: string): Promise<T> {
  const raw = await res.text();
  if (!raw) {
    throw new Error(fallbackMsg);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(res.status >= 500 ? 'حدث خطأ مؤقت في الخادم، يرجى المحاولة مجدداً.' : fallbackMsg);
  }
}

export async function hashGuardianPin(pin: string): Promise<string> {
  const headers = await getBearerHeaders();
  const res = await fetch('/api/guardian/pin/hash', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pin }),
  });
  const data = await parseJsonSafely<{ pinHash?: string; error?: string }>(res, 'تعذر تشفير رمز الحماية.');
  if (!res.ok || !data.pinHash) {
    throw new Error(data.error || 'تعذر تشفير رمز الحماية.');
  }
  return data.pinHash;
}

export async function verifyGuardianPin(pin: string, pinHash: string): Promise<boolean> {
  const headers = await getBearerHeaders();
  const res = await fetch('/api/guardian/pin/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pin, pinHash }),
  });
  const data = await parseJsonSafely<{ verified?: boolean; error?: string }>(res, 'تعذر التحقق من رمز الحماية.');
  if (!res.ok) {
    throw new Error(data.error || 'تعذر التحقق من رمز الحماية.');
  }
  return data.verified === true;
}

async function fetchPrayerTimesDirectFromAladhan(params: {
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  method?: number;
}): Promise<PrayerTimesResponse> {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const resolved = resolveKnownLocation(params.city, params.country);
  const lat = typeof params.lat === 'number' ? params.lat : resolved?.lat;
  const lng = typeof params.lng === 'number' ? params.lng : resolved?.lng;
  const method = params.method ?? resolved?.method ?? inferCalculationMethod(params.country);

  let targetUrl: URL;
  if (typeof lat === 'number' && typeof lng === 'number') {
    targetUrl = new URL(`https://api.aladhan.com/v1/timings/${dateStr}`);
    targetUrl.searchParams.set('latitude', lat.toFixed(4));
    targetUrl.searchParams.set('longitude', lng.toFixed(4));
    targetUrl.searchParams.set('method', String(method));
  } else {
    targetUrl = new URL(`https://api.aladhan.com/v1/timingsByCity/${dateStr}`);
    targetUrl.searchParams.set('city', resolved?.cityEn || params.city || 'Cairo');
    targetUrl.searchParams.set('country', resolved?.countryEn || params.country || 'Egypt');
    targetUrl.searchParams.set('method', String(method));
  }

  const controller = new AbortController();
  const tid = window.setTimeout(() => controller.abort(), 8000);
  const upstream = await fetch(targetUrl.toString(), { signal: controller.signal });
  window.clearTimeout(tid);
  if (!upstream.ok) {
    throw new Error('تعذر جلب مواقيت الصلاة حالياً. تأكد من اتصالك بالإنترنت.');
  }

  const json = (await upstream.json()) as {
    data?: {
      timings?: Record<string, string>;
      date?: {
        hijri?: PrayerTimesResponse['hijri'];
      };
      meta?: { timezone?: string; method?: { name?: string } };
    };
  };
  const timings = json.data?.timings;
  if (!timings) {
    throw new Error('بيانات مواقيت الصلاة غير مكتملة.');
  }
  const stripOffset = (t?: string) => (t ? t.split(' ')[0] : '--:--');
  return {
    timings: {
      Fajr: stripOffset(timings.Fajr),
      Sunrise: stripOffset(timings.Sunrise),
      Dhuhr: stripOffset(timings.Dhuhr),
      Asr: stripOffset(timings.Asr),
      Maghrib: stripOffset(timings.Maghrib),
      Isha: stripOffset(timings.Isha),
    },
    hijri: json.data?.date?.hijri ?? null,
    timezone: json.data?.meta?.timezone ?? '',
    methodName: json.data?.meta?.method?.name ?? '',
  };
}

export async function fetchPrayerTimes(params: {
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  method?: number;
}): Promise<PrayerTimesResponse> {
  const resolved = resolveKnownLocation(params.city, params.country);
  const effectiveLat = typeof params.lat === 'number' ? params.lat : resolved?.lat;
  const effectiveLng = typeof params.lng === 'number' ? params.lng : resolved?.lng;
  const effectiveMethod = params.method ?? resolved?.method ?? inferCalculationMethod(params.country);

  // Try authenticated backend proxy first, then seamlessly fallback to direct Aladhan HTTPS API
  try {
    const headers = await getBearerHeaders();
    const url = new URL('/api/prayer-times', window.location.origin);
    if (typeof effectiveLat === 'number' && typeof effectiveLng === 'number') {
      url.searchParams.set('lat', String(effectiveLat));
      url.searchParams.set('lng', String(effectiveLng));
    } else {
      url.searchParams.set('city', resolved?.cityEn || params.city || 'Cairo');
      url.searchParams.set('country', resolved?.countryEn || params.country || 'Egypt');
    }
    url.searchParams.set('method', String(effectiveMethod));

    const res = await fetch(url.toString(), { headers });
    const data = await parseJsonSafely<PrayerTimesResponse & { error?: string }>(
      res,
      'تعذر جلب مواقيت الصلاة.'
    );
    if (res.ok && data?.timings) {
      return data;
    }
  } catch {
    // Fall through cleanly to direct Aladhan HTTPS fallback
  }

  return fetchPrayerTimesDirectFromAladhan({
    city: params.city,
    country: params.country,
    lat: effectiveLat,
    lng: effectiveLng,
    method: effectiveMethod,
  });
}

export interface AIAnalysisOutput {
  summary: string;
  strongestAxis: string;
  improvementAxis: string;
  recurringPatterns: string;
  studyConsistency: string;
  responsibilityFollowup: string;
  prayerSummary: string;
  performanceDelta: string;
  recommendations: string[];
}

export async function requestAIAnalysis(payload: {
  profileName: string;
  profileAge: number;
  period: 'daily' | 'weekly' | 'monthly';
  dateKey: string;
  records: Record<string, unknown>;
}): Promise<AIAnalysisOutput> {
  const headers = await getBearerHeaders();
  const res = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely<{ analysis?: AIAnalysisOutput; error?: string }>(
    res,
    'تعذر توليد التحليل الذكي.'
  );
  if (!res.ok || !data.analysis) {
    throw new Error(data.error || 'تعذر توليد التحليل الذكي.');
  }
  return data.analysis;
}

export interface SignedDeviceGrantPayload {
  uid: string;
  email: string;
  displayName?: string;
  subscriptionStatus: 'active' | 'suspended';
  validFrom: string;
  validUntil: string;
  subscriptionPlanLabel: string;
  subscriptionPrice: number;
  updatedAt?: string;
}

export interface SignedDeviceSettingsPayload {
  whatsappNumber: string;
  defaultMonthlyPrice: number;
  currency: string;
  updatedAt?: string;
}

export async function loginAdminPanel(username: string, password: string): Promise<string> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafely<{ adminToken?: string; error?: string }>(
    res,
    'تعذر التحقق من بيانات الإدارة.'
  );
  if (!res.ok || !data.adminToken) {
    throw new Error(data.error || 'بيانات الدخول غير صحيحة.');
  }
  return data.adminToken;
}

export async function issueSignedDeviceGrant(
  adminToken: string,
  payload: SignedDeviceGrantPayload
): Promise<string> {
  const res = await fetch('/api/admin/device-grant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely<{ grantToken?: string; error?: string }>(
    res,
    'تعذر إصدار تصريح التشغيل.'
  );
  if (!res.ok || !data.grantToken) {
    throw new Error(data.error || 'تعذر إصدار تصريح التشغيل.');
  }
  return data.grantToken;
}

export async function issueSignedDeviceSettings(
  adminToken: string,
  payload: SignedDeviceSettingsPayload
): Promise<string> {
  const res = await fetch('/api/admin/settings-grant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely<{ settingsToken?: string; error?: string }>(
    res,
    'تعذر حفظ إعدادات الاشتراك.'
  );
  if (!res.ok || !data.settingsToken) {
    throw new Error(data.error || 'تعذر حفظ إعدادات الاشتراك.');
  }
  return data.settingsToken;
}

export async function verifyStoredDeviceTokens(
  grantTokens: string[],
  settingsToken: string
): Promise<{
  grants: SignedDeviceGrantPayload[];
  settings: SignedDeviceSettingsPayload | null;
}> {
  const res = await fetch('/api/subscription/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantTokens, settingsToken }),
  });
  const data = await parseJsonSafely<{
    grants?: SignedDeviceGrantPayload[];
    settings?: SignedDeviceSettingsPayload | null;
  }>(res, 'تعذر التحقق من حالة الاشتراك.');
  if (!res.ok) {
    return { grants: [], settings: null };
  }
  return {
    grants: Array.isArray(data.grants) ? data.grants : [],
    settings: data.settings ?? null,
  };
}

