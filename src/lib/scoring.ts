import type {
  AxisKey,
  AxisState,
  AxisWeights,
  BehaviorObservation,
  DailyAssessment,
  PrayerKey,
  PrayerRecord,
  StudySession,
  TaskItem,
} from '../types/behavior';

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOffsetDateKey(daysOffset: number, baseDateKey?: string): string {
  const base = baseDateKey ? new Date(`${baseDateKey}T12:00:00`) : new Date();
  base.setDate(base.getDate() + daysOffset);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatArabicGregorian(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatHijriDate(dateKey: string): string {
  try {
    const date = new Date(`${dateKey}T12:00:00`);
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

export function clampScore(val: number): number {
  return Math.round(Math.min(10, Math.max(1, val)) * 10) / 10;
}

export function computeObedienceScore(
  observations: BehaviorObservation[],
  manualState: AxisState
): number | null {
  if (observations.length === 0) {
    if (manualState === 'unrated') return null;
    if (manualState === 'committed') return 9;
    if (manualState === 'partial') return 6;
    return 3;
  }
  const sum = observations.reduce((acc, obs) => {
    let base = obs.outcome === 'positive' ? 9.5 : obs.outcome === 'partial' ? 6.5 : 3.5;
    if (obs.firstTimeResponse) base += 0.5;
    if (obs.neededReminder) base -= 0.7;
    // Polite questioning is healthy expression and is NOT penalized
    if (obs.isPoliteQuestion && obs.outcome !== 'needs_support') {
      base = Math.max(base, 8.5);
    }
    return acc + clampScore(base);
  }, 0);
  return clampScore(sum / observations.length);
}

export function computeStudyScore(
  sessions: StudySession[],
  manualState: AxisState
): number | null {
  if (sessions.length === 0) {
    if (manualState === 'unrated') return null;
    if (manualState === 'committed') return 9;
    if (manualState === 'partial') return 6;
    return 3;
  }
  const sum = sessions.reduce((acc, s) => {
    const statusBase =
      s.status === 'completed'
        ? 9
        : s.status === 'partial'
          ? 6.5
          : s.status === 'postponed'
            ? 4.5
            : 2.5;
    // Factor in qualityRating & focusLevel (1..5)
    const qualityFactor = ((s.qualityRating + s.focusLevel) / 10) * 2 - 1; // -0.6 to +1
    const timeRatio = s.targetMinutes > 0 ? Math.min(1.1, s.actualMinutes / s.targetMinutes) : 1;
    const score = statusBase + qualityFactor + (timeRatio >= 0.9 ? 0.5 : -0.5);
    return acc + clampScore(score);
  }, 0);
  return clampScore(sum / sessions.length);
}

export function computePrayerScore(
  prayerRecord: PrayerRecord | null,
  manualState: AxisState
): number | null {
  const keys: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  if (!prayerRecord) {
    if (manualState === 'unrated') return null;
    if (manualState === 'committed') return 9;
    if (manualState === 'partial') return 6;
    return 3;
  }
  const logged = keys.filter((k) => prayerRecord.prayers[k]?.status !== 'unlogged');
  if (logged.length === 0) {
    if (manualState === 'unrated') return null;
    if (manualState === 'committed') return 9;
    if (manualState === 'partial') return 6;
    return 3;
  }
  const total = logged.reduce((acc, k) => {
    const st = prayerRecord.prayers[k].status;
    if (st === 'on_time') return acc + 10;
    if (st === 'late') return acc + 7;
    return acc + 2;
  }, 0);
  return clampScore(total / logged.length);
}

export function computeResponsibilitiesScore(
  tasks: TaskItem[],
  manualState: AxisState
): number | null {
  if (tasks.length === 0) {
    if (manualState === 'unrated') return null;
    if (manualState === 'committed') return 9;
    if (manualState === 'partial') return 6;
    return 3;
  }
  const evaluated = tasks.filter((t) => t.status !== 'pending');
  if (evaluated.length === 0) {
    if (manualState === 'unrated') return null;
    if (manualState === 'committed') return 9;
    if (manualState === 'partial') return 6;
    return 3;
  }
  const total = evaluated.reduce((acc, t) => {
    let base = t.status === 'completed' ? 9.2 : t.status === 'partial' ? 6.2 : 2.5;
    if (t.guardianApproved && t.status === 'completed') base += 0.8;
    return acc + clampScore(base);
  }, 0);
  return clampScore(total / evaluated.length);
}

export function computeWeightedTotal(
  scores: Record<AxisKey, number | null>,
  weights: AxisWeights
): number | null {
  const axes: AxisKey[] = ['obedience', 'study', 'prayer', 'responsibilities'];
  let weightedSum = 0;
  let activeWeight = 0;

  for (const axis of axes) {
    const val = scores[axis];
    if (val !== null && Number.isFinite(val)) {
      weightedSum += val * weights[axis];
      activeWeight += weights[axis];
    }
  }

  if (activeWeight === 0) return null;
  return clampScore(weightedSum / activeWeight);
}

export function getScoreClassification(score: number | null): {
  labelAr: string;
  labelEn: string;
  tone: 'emerald' | 'teal' | 'blue' | 'amber' | 'rose' | 'neutral';
} {
  if (score === null) {
    return {
      labelAr: 'لم يُقيّم بعد',
      labelEn: 'Not Rated Yet',
      tone: 'neutral',
    };
  }
  if (score >= 9.5) {
    return { labelAr: 'التزام متميز', labelEn: 'Outstanding', tone: 'emerald' };
  }
  if (score >= 8.5) {
    return { labelAr: 'ممتاز', labelEn: 'Excellent', tone: 'emerald' };
  }
  if (score >= 7) {
    return { labelAr: 'مستوى جيد', labelEn: 'Good', tone: 'teal' };
  }
  if (score >= 5) {
    return { labelAr: 'مستوى متوسط', labelEn: 'Average', tone: 'blue' };
  }
  if (score >= 3) {
    return { labelAr: 'يحتاج إلى تحسين', labelEn: 'Needs Improvement', tone: 'amber' };
  }
  return { labelAr: 'يحتاج إلى دعم وتحسين كبير', labelEn: 'Needs Significant Support', tone: 'rose' };
}

export function deriveAxisState(score: number | null): AxisState {
  if (score === null) return 'unrated';
  if (score >= 7.5) return 'committed';
  if (score >= 4.5) return 'partial';
  return 'not_committed';
}

export function calculateStreak(assessments: DailyAssessment[]): number {
  const sorted = [...assessments]
    .filter((a) => a.scores.total !== null && a.scores.total >= 6.5)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  if (sorted.length === 0) return 0;

  const today = getTodayDateKey();
  const yesterday = getOffsetDateKey(-1, today);
  if (sorted[0].dateKey !== today && sorted[0].dateKey !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const expectedPrev = getOffsetDateKey(-1, sorted[i - 1].dateKey);
    if (sorted[i].dateKey === expectedPrev) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function averageScoresOverDays(
  assessments: DailyAssessment[],
  days: number,
  referenceDateKey: string
): number | null {
  const minDate = getOffsetDateKey(-(days - 1), referenceDateKey);
  const valid = assessments.filter(
    (a) => a.dateKey >= minDate && a.dateKey <= referenceDateKey && a.scores.total !== null
  );
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, a) => acc + (a.scores.total ?? 0), 0);
  return Math.round((sum / valid.length) * 10) / 10;
}
