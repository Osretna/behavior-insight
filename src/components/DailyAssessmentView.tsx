import React, { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Info, Save, ShieldCheck } from 'lucide-react';
import {
  AXIS_META,
  type AppMode,
  type AxisKey,
  type AxisState,
  type BehaviorObservation,
  type DailyAssessment,
  type MonitoredProfile,
  type PrayerRecord,
  type StudySession,
  type TaskItem,
} from '../types/behavior';
import {
  computeObedienceScore,
  computePrayerScore,
  computeResponsibilitiesScore,
  computeStudyScore,
  computeWeightedTotal,
  formatArabicGregorian,
  getScoreClassification,
  getTodayDateKey,
} from '../lib/scoring';
import {
  ensureDailyAssessment,
  overrideAssessmentScore,
  saveDailyAssessment,
} from '../lib/firestoreService';

export function DailyAssessmentView({
  uid,
  profile,
  appMode,
  guardianName,
  initialDateKey,
  assessments,
  observations,
  studySessions,
  prayerRecords,
  tasks,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  guardianName: string;
  initialDateKey?: string;
  assessments: DailyAssessment[];
  observations: BehaviorObservation[];
  studySessions: StudySession[];
  prayerRecords: PrayerRecord[];
  tasks: TaskItem[];
}) {
  const [dateKey, setDateKey] = useState(initialDateKey || getTodayDateKey());

  useEffect(() => {
    if (initialDateKey) setDateKey(initialDateKey);
  }, [initialDateKey]);

  const existing = assessments.find((a) => a.dateKey === dateKey);

  const [axisStates, setAxisStates] = useState<Record<AxisKey, AxisState>>({
    obedience: 'unrated',
    study: 'unrated',
    prayer: 'unrated',
    responsibilities: 'unrated',
  });
  const [directAxisScores, setDirectAxisScores] = useState<Record<AxisKey, number | null>>({
    obedience: null,
    study: null,
    prayer: null,
    responsibilities: null,
  });
  const [dailyEvents, setDailyEvents] = useState('');
  const [endOfDaySummary, setEndOfDaySummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Manual Override modal state
  const [showOverride, setShowOverride] = useState(false);
  const [overrideScores, setOverrideScores] = useState({
    obedience: '',
    study: '',
    prayer: '',
    responsibilities: '',
  });
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    ensureDailyAssessment(uid, profile.id, dateKey).catch(() => {});
  }, [uid, profile.id, dateKey]);

  useEffect(() => {
    setDirectAxisScores({
      obedience: null,
      study: null,
      prayer: null,
      responsibilities: null,
    });
  }, [profile.id, dateKey]);

  useEffect(() => {
    if (existing) {
      setAxisStates(existing.axisStates);
      setDailyEvents(existing.dailyEvents);
      setEndOfDaySummary(existing.endOfDaySummary);
      setOverrideScores({
        obedience: existing.scores.obedience !== null ? String(existing.scores.obedience) : '',
        study: existing.scores.study !== null ? String(existing.scores.study) : '',
        prayer: existing.scores.prayer !== null ? String(existing.scores.prayer) : '',
        responsibilities: existing.scores.responsibilities !== null ? String(existing.scores.responsibilities) : '',
      });
    } else {
      setAxisStates({
        obedience: 'unrated',
        study: 'unrated',
        prayer: 'unrated',
        responsibilities: 'unrated',
      });
      setDailyEvents('');
      setEndOfDaySummary('');
    }
  }, [existing, dateKey]);

  const dayObs = observations.filter((o) => o.dateKey === dateKey);
  const dayStudy = studySessions.filter((s) => s.dateKey === dateKey);
  const dayPrayer = prayerRecords.find((p) => p.dateKey === dateKey) ?? null;
  const dayTasks = tasks.filter((t) => t.dateKey === dateKey);

  const hasObsLogs = dayObs.length > 0;
  const hasStudyLogs = dayStudy.length > 0;
  const hasPrayerLogs =
    !!dayPrayer && Object.values(dayPrayer.prayers).some((p) => p.status !== 'unlogged');
  const hasTaskLogs = dayTasks.some((t) => t.status !== 'pending');

  const computedObedience =
    directAxisScores.obedience ??
    (hasObsLogs ? computeObedienceScore(dayObs, axisStates.obedience) : existing?.scores.obedience ?? computeObedienceScore([], axisStates.obedience));
  const computedStudy =
    directAxisScores.study ??
    (hasStudyLogs
      ? computeStudyScore(dayStudy, axisStates.study, profile.dailyGoalMinutes)
      : existing?.scores.study ?? computeStudyScore([], axisStates.study, profile.dailyGoalMinutes));
  const computedPrayer =
    directAxisScores.prayer ??
    (hasPrayerLogs ? computePrayerScore(dayPrayer, axisStates.prayer) : existing?.scores.prayer ?? computePrayerScore(null, axisStates.prayer));
  const computedResp =
    directAxisScores.responsibilities ??
    (hasTaskLogs
      ? computeResponsibilitiesScore(dayTasks, axisStates.responsibilities)
      : existing?.scores.responsibilities ?? computeResponsibilitiesScore([], axisStates.responsibilities));

  const activeScores = existing?.manualOverride?.isOverridden
    ? existing.scores
    : {
        obedience: computedObedience,
        study: computedStudy,
        prayer: computedPrayer,
        responsibilities: computedResp,
        total: computeWeightedTotal(
          {
            obedience: computedObedience,
            study: computedStudy,
            prayer: computedPrayer,
            responsibilities: computedResp,
          },
          profile.weights
        ),
      };

  const classification = getScoreClassification(activeScores.total);

  const stateOptions: { value: AxisState; label: string }[] = [
    { value: 'committed', label: 'تم الالتزام' },
    { value: 'partial', label: 'التزام جزئي' },
    { value: 'not_committed', label: 'لم يتم الالتزام' },
    { value: 'unrated', label: 'لم يتم التقييم بعد' },
  ];

  const handleSave = async (status: 'draft' | 'finalized') => {
    setSaving(true);
    setFeedback(null);
    try {
      await saveDailyAssessment(
        uid,
        profile.id,
        dateKey,
        {
          status,
          axisStates,
          scores: {
            obedience: computedObedience,
            study: computedStudy,
            prayer: computedPrayer,
            responsibilities: computedResp,
            total: computeWeightedTotal(
              {
                obedience: computedObedience,
                study: computedStudy,
                prayer: computedPrayer,
                responsibilities: computedResp,
              },
              profile.weights
            ),
          },
          dailyEvents,
          endOfDaySummary,
        },
        existing
      );
      setFeedback(status === 'finalized' ? 'تم اعتماد التقييم اليومي وحفظه بنجاح.' : 'تم حفظ التقييم كمسودة بنجاح.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overrideReason.trim().length < 3) {
      setFeedback('يجب كتابة سبب التعديل اليدوي.');
      return;
    }
    const parseVal = (v: string): number | null => {
      if (!v.trim()) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.round(Math.min(10, Math.max(1, n)) * 10) / 10;
    };
    const nextAxisScores = {
      obedience: parseVal(overrideScores.obedience),
      study: parseVal(overrideScores.study),
      prayer: parseVal(overrideScores.prayer),
      responsibilities: parseVal(overrideScores.responsibilities),
    };
    const nextTotal = computeWeightedTotal(nextAxisScores, profile.weights);
    setSaving(true);
    try {
      await overrideAssessmentScore(
        uid,
        profile.id,
        dateKey,
        { ...nextAxisScores, total: nextTotal },
        activeScores.total,
        overrideReason,
        guardianName
      );
      setShowOverride(false);
      setOverrideReason('');
      setFeedback('تم تعديل الدرجة يدوياً وتوثيق السبب في سجل التعديلات.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر تعديل الدرجة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">التقييم اليومي الشامل</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatArabicGregorian(dateKey)} <span aria-hidden="true">·</span> {profile.name}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateKey}
            max={getTodayDateKey()}
            onChange={(e) => setDateKey(e.target.value || getTodayDateKey())}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D192D] text-sm text-slate-900 dark:text-white tabular-nums"
          />
        </div>
      </div>

      {/* Important Principle Banner */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            التقييم محسوب أوتوماتيكياً من 1 إلى 10 بناءً على ما تم إدخاله في المحاور الأربعة والأوزان المعتمدة. المحاور غير المسجلة بعد لا تتحول إلى أصفار.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-500/20">
            مواقف: {dayObs.length}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-500/20">
            مذاكرة: {dayStudy.length}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-500/20">
            صلوات: {dayPrayer ? Object.values(dayPrayer.prayers).filter((p) => p.status !== 'unlogged').length : 0}/5
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-emerald-500/20">
            مهام منجزة: {dayTasks.filter((t) => t.status === 'completed').length}/{dayTasks.length}
          </span>
        </div>
      </div>

      {/* Overall Score Summary */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            الدرجة الإجمالية الموزونة {existing?.manualOverride?.isOverridden && '(معدّلة يدوياً وموثقة)'}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
              {activeScores.total !== null ? activeScores.total.toFixed(1) : '—'}
            </span>
            <span className="text-base text-slate-400">/ 10</span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {classification.labelAr}
            </span>
          </div>
          {existing?.manualOverride?.isOverridden && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              السبب: {existing.manualOverride.reason} · بواسطة: {existing.manualOverride.modifiedBy}
            </p>
          )}
        </div>

        {appMode === 'guardian' && (
          <button
            type="button"
            onClick={() => setShowOverride((prev) => !prev)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Edit3 className="w-4 h-4" />
            <span>تعديل الدرجة يدوياً (مع توثيق السبب)</span>
          </button>
        )}
      </div>

      {showOverride && appMode === 'guardian' && (
        <form
          onSubmit={handleManualOverride}
          className="p-6 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-4"
        >
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>تعديل يدوي موثق في سجل التدقيق</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((axis) => (
              <div key={axis}>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  {AXIS_META[axis].titleAr} (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step="0.5"
                  value={overrideScores[axis]}
                  onChange={(e) => setOverrideScores({ ...overrideScores, [axis]: e.target.value })}
                  placeholder="فارغ = غير مقيم"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm tabular-nums"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
              سبب التعديل اليدوي (إلزامي)
            </label>
            <input
              type="text"
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="مثال: مراعاة ظروف صحية أو تقدير جهد إضافي غير مسجل"
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOverride(false)}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold cursor-pointer"
            >
              حفظ التعديل وتوثيقه
            </button>
          </div>
        </form>
      )}

      {/* Four Axes Interactive Evaluation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((axis) => {
          const scoreVal = activeScores[axis];
          const deriveAxisState = (val: number): AxisState =>
            val >= 7.5 ? 'committed' : val >= 4.5 ? 'partial' : 'not_committed';

          return (
            <div
              key={axis}
              className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {AXIS_META[axis].titleAr}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    الوزن المعتمد: {profile.weights[axis]}%
                    {directAxisScores[axis] !== null ? ' · تقييم مباشر' : ' · محسوب تلقائياً'}
                  </p>
                </div>
                <div className="text-left tabular-nums">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {scoreVal !== null ? scoreVal.toFixed(1) : '—'}
                  </span>
                  <span className="text-xs text-slate-400"> / 10</span>
                </div>
              </div>

              {appMode === 'guardian' && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      تحديد الدرجة مباشرة (1 إلى 10)
                    </span>
                    {directAxisScores[axis] !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          setDirectAxisScores((prev) => ({ ...prev, [axis]: null }))
                        }
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        إعادة للحساب التلقائي
                      </button>
                    )}
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={scoreVal ?? 8}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDirectAxisScores((prev) => ({ ...prev, [axis]: val }));
                      setAxisStates((prev) => ({ ...prev, [axis]: deriveAxisState(val) }));
                    }}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { val: 10, label: 'ممتاز 10' },
                      { val: 8, label: 'جيد جداً 8' },
                      { val: 6, label: 'متوسط 6' },
                      { val: 4, label: 'دعم 4' },
                    ].map((preset) => {
                      const isSelected = directAxisScores[axis] === preset.val;
                      return (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => {
                            setDirectAxisScores((prev) => ({ ...prev, [axis]: preset.val }));
                            setAxisStates((prev) => ({
                              ...prev,
                              [axis]: deriveAxisState(preset.val),
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {stateOptions.map((opt) => {
                  const active = axisStates[axis] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={appMode === 'tracked'}
                      onClick={() => {
                        setAxisStates((prev) => ({ ...prev, [axis]: opt.value }));
                        setDirectAxisScores((prev) => ({ ...prev, [axis]: null }));
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                        active
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily Events & End of Day Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-2">
          <label className="block font-bold text-sm text-slate-900 dark:text-white">
            أحداث اليوم والمواقف المهمة
          </label>
          <textarea
            rows={4}
            readOnly={appMode === 'tracked'}
            value={dailyEvents}
            onChange={(e) => setDailyEvents(e.target.value)}
            placeholder="سجل أبرز المواقف الإيجابية أو التحديات التي حدثت اليوم..."
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-2">
          <label className="block font-bold text-sm text-slate-900 dark:text-white">
            ملخص نهاية اليوم والتشجيع
          </label>
          <textarea
            rows={4}
            readOnly={appMode === 'tracked'}
            value={endOfDaySummary}
            onChange={(e) => setEndOfDaySummary(e.target.value)}
            placeholder="خلاصة اليوم وكلمة تشجيعية بناءة..."
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {appMode === 'guardian' && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D192D] text-slate-800 dark:text-slate-100 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ كمسودة للاستكمال لاحقاً</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('finalized')}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>اعتماد التقييم اليومي</span>
          </button>
        </div>
      )}
    </div>
  );
}
