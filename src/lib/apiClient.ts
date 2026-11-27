import { auth } from './firebase';
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

export async function hashGuardianPin(pin: string): Promise<string> {
  const headers = await getBearerHeaders();
  const res = await fetch('/api/guardian/pin/hash', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pin }),
  });
  const data = (await res.json()) as { pinHash?: string; error?: string };
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
  const data = (await res.json()) as { verified?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'تعذر التحقق من رمز الحماية.');
  }
  return data.verified === true;
}

export async function fetchPrayerTimes(params: {
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  method?: number;
}): Promise<PrayerTimesResponse> {
  const headers = await getBearerHeaders();
  const url = new URL('/api/prayer-times', window.location.origin);
  if (typeof params.lat === 'number' && typeof params.lng === 'number') {
    url.searchParams.set('lat', String(params.lat));
    url.searchParams.set('lng', String(params.lng));
  } else {
    if (params.city) url.searchParams.set('city', params.city);
    if (params.country) url.searchParams.set('country', params.country);
  }
  if (params.method) url.searchParams.set('method', String(params.method));

  const res = await fetch(url.toString(), { headers });
  const data = (await res.json()) as PrayerTimesResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'تعذر جلب مواقيت الصلاة.');
  }
  return data;
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
  const data = (await res.json()) as { analysis?: AIAnalysisOutput; error?: string };
  if (!res.ok || !data.analysis) {
    throw new Error(data.error || 'تعذر توليد التحليل الذكي.');
  }
  return data.analysis;
}
