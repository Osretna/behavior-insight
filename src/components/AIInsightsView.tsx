import React, { useState } from 'react';
import { Check, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import type {
  AIInsight,
  AppMode,
  BehaviorObservation,
  DailyAssessment,
  MonitoredProfile,
  PrayerRecord,
  StudySession,
  TaskItem,
} from '../types/behavior';
import { requestAIAnalysis } from '../lib/apiClient';
import { reviewAIInsight, saveAIInsight } from '../lib/firestoreService';
import { getOffsetDateKey, getTodayDateKey } from '../lib/scoring';

export function AIInsightsView({
  uid,
  profile,
  appMode,
  guardianName,
  assessments,
  observations,
  studySessions,
  prayerRecords,
  tasks,
  aiInsights,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  guardianName: string;
  assessments: DailyAssessment[];
  observations: BehaviorObservation[];
  studySessions: StudySession[];
  prayerRecords: PrayerRecord[];
  tasks: TaskItem[];
  aiInsights: AIInsight[];
}) {
  const todayKey = getTodayDateKey();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAnalysis = async () => {
    setLoading(true);
    setError(null);
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const minDate = getOffsetDateKey(-(days - 1), todayKey);

    const filteredRecords = {
      periodDays: days,
      dateRange: { from: minDate, to: todayKey },
      dailyAssessments: assessments
        .filter((a) => a.dateKey >= minDate && a.dateKey <= todayKey)
        .map((a) => ({
          dateKey: a.dateKey,
          status: a.status,
          scores: a.scores,
          dailyEvents: a.dailyEvents,
        })),
      obedienceObservations: observations
        .filter((o) => o.dateKey >= minDate && o.dateKey <= todayKey)
        .map((o) => ({
          dateKey: o.dateKey,
          situation: o.situation,
          outcome: o.outcome,
          firstTimeResponse: o.firstTimeResponse,
          neededReminder: o.neededReminder,
          isPoliteQuestion: o.isPoliteQuestion,
        })),
      studySessions: studySessions
        .filter((s) => s.dateKey >= minDate && s.dateKey <= todayKey)
        .map((s) => ({
          dateKey: s.dateKey,
          subject: s.subject,
          targetMinutes: s.targetMinutes,
          actualMinutes: s.actualMinutes,
          focusLevel: s.focusLevel,
          qualityRating: s.qualityRating,
          status: s.status,
        })),
      prayerRecords: prayerRecords
        .filter((p) => p.dateKey >= minDate && p.dateKey <= todayKey)
        .map((p) => ({
          dateKey: p.dateKey,
          prayers: Object.fromEntries(
            Object.entries(p.prayers).map(([k, v]) => [k, v.status])
          ),
        })),
      tasks: tasks
        .filter((t) => t.dateKey >= minDate && t.dateKey <= todayKey)
        .map((t) => ({
          dateKey: t.dateKey,
          title: t.title,
          status: t.status,
          guardianApproved: t.guardianApproved,
        })),
    };

    try {
      const output = await requestAIAnalysis({
        profileName: profile.name,
        profileAge: profile.age,
        period,
        dateKey: todayKey,
        records: filteredRecords,
      });

      await saveAIInsight(uid, profile.id, {
        dateKey: todayKey,
        period,
        summary: output.summary,
        strongestAxis: output.strongestAxis,
        improvementAxis: output.improvementAxis,
        recurringPatterns: output.recurringPatterns,
        studyConsistency: output.studyConsistency,
        responsibilityFollowup: output.responsibilityFollowup,
        prayerSummary: output.prayerSummary,
        performanceDelta: output.performanceDelta,
        recommendations: output.recommendations,
        status: 'pending_review',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إجراء التحليل الذكي.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            التحليل الذكي للسلوك (AI)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            تحليل موضوعي يستند إلى السجلات الفعلية الموجودة فقط مع مراجعة التوصيات قبل اعتمادها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
            {[
              { id: 'daily', label: 'يومي' },
              { id: 'weekly', label: 'أسبوعي' },
              { id: 'monthly', label: 'شهري' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as typeof period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  period === p.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGenerateAnalysis}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'جاري التحليل من السجلات...' : 'توليد تحليل ذكي جديد'}</span>
          </button>
        </div>
      </div>

      {/* Strict AI Guardrails Banner */}
      <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800/50 flex items-start gap-3 text-xs sm:text-sm text-sky-900 dark:text-sky-200">
        <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          ضوابط التحليل الذكي: يعتمد المحرك على السجلات الفعلية فقط دون اختلاق بيانات، ولا يصدر تشخيصاً نفسياً أو أحكاماً دينية، وتخضع جميع التوصيات لمراجعة ولي الأمر قبل اعتمادها.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {aiInsights.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-base text-slate-900 dark:text-white">لا توجد تحليلات محفوظة بعد</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            بعد تسجيل مواقف أو جلسات مذاكرة أو صلوات أو مهام، اضغط على «توليد تحليل ذكي جديد» لقراءة الأنماط وتقديم توصيات عملية.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {aiInsights.map((ins) => (
            <article
              key={ins.id}
              className="p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {ins.dateKey} ·{' '}
                    {ins.period === 'daily'
                      ? 'تحليل يومي'
                      : ins.period === 'weekly'
                        ? 'تحليل أسبوعي'
                        : 'تحليل شهري'}
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mt-0.5">
                    ملخص البيانات الفعلية والاستنتاجات
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {ins.status === 'pending_review' ? (
                    appMode === 'guardian' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            reviewAIInsight(uid, profile.id, ins.id, 'approved', guardianName)
                          }
                          className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>اعتماد التوصيات</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            reviewAIInsight(uid, profile.id, ins.id, 'rejected', guardianName)
                          }
                          className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>استبعاد</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        بانتظار مراجعة ولي الأمر
                      </span>
                    )
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        ins.status === 'approved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {ins.status === 'approved'
                          ? `معتمد من ${ins.approvedBy || 'ولي الأمر'}`
                          : 'تم استبعاده'}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{ins.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">أقوى محور مسجل</div>
                  <p className="text-slate-700 dark:text-slate-200">{ins.strongestAxis}</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40">
                  <div className="font-bold text-amber-700 dark:text-amber-300 mb-1">محور يحتاج إلى دعم</div>
                  <p className="text-slate-700 dark:text-slate-200">{ins.improvementAxis}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">الأنماط المتكررة</div>
                  <p className="text-slate-600 dark:text-slate-300">{ins.recurringPatterns}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">التغير مقارنة بالأيام السابقة</div>
                  <p className="text-slate-600 dark:text-slate-300">{ins.performanceDelta}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">انتظام المذاكرة</div>
                  <p className="text-slate-600 dark:text-slate-300">{ins.studyConsistency}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">متابعة المسؤوليات والصلاة</div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {ins.responsibilityFollowup} · {ins.prayerSummary}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
                  التوصيات العملية المقترحة (الاستنتاجات)
                </h4>
                <ul className="space-y-2">
                  {ins.recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <span className="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
