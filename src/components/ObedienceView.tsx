import React, { useState } from 'react';
import { CheckCircle2, Compass, MessageSquareHeart, Plus, Trash2 } from 'lucide-react';
import {
  AXIS_META,
  type AppMode,
  type BehaviorObservation,
  type MonitoredProfile,
} from '../types/behavior';
import { addObservation, deleteObservation } from '../lib/firestoreService';
import { computeObedienceScore, getTodayDateKey } from '../lib/scoring';

export function ObedienceView({
  uid,
  profile,
  appMode,
  observations,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  observations: BehaviorObservation[];
}) {
  const todayKey = getTodayDateKey();
  const [dateFilter, setDateFilter] = useState(todayKey);
  const [situation, setSituation] = useState('');
  const [guidanceGiven, setGuidanceGiven] = useState('');
  const [reaction, setReaction] = useState('');
  const [outcome, setOutcome] = useState<'positive' | 'partial' | 'needs_support'>('positive');
  const [firstTimeResponse, setFirstTimeResponse] = useState(true);
  const [neededReminder, setNeededReminder] = useState(false);
  const [isPoliteQuestion, setIsPoliteQuestion] = useState(false);
  const [criterionKey, setCriterionKey] = useState(AXIS_META.obedience.defaultCriteria[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dayObservations = observations.filter((o) => o.dateKey === dateFilter);
  const dayScore = computeObedienceScore(dayObservations, 'unrated');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!situation.trim() || !guidanceGiven.trim() || !reaction.trim()) return;
    setSubmitting(true);
    setMessage(null);
    const pointsAwarded =
      outcome === 'positive' ? (firstTimeResponse ? 15 : 10) : outcome === 'partial' ? 5 : 0;

    try {
      await addObservation(uid, profile.id, {
        dateKey: dateFilter,
        situation,
        guidanceGiven,
        reaction,
        outcome,
        firstTimeResponse,
        neededReminder,
        criterionKey,
        isPoliteQuestion,
        pointsAwarded,
        notes,
      });
      setSituation('');
      setGuidanceGiven('');
      setReaction('');
      setNotes('');
      setIsPoliteQuestion(false);
      setMessage('تم تسجيل الموقف السلوكي وتحديث المؤشر.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'تعذر تسجيل الموقف.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            المحور الأول: سماع الكلام والاستجابة للتوجيهات
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            تقييم موضوعي للاستجابة للتوجيهات مع التمييز بين عدم الاستجابة وبين السؤال والحوار بأدب
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateFilter}
            max={todayKey}
            onChange={(e) => setDateFilter(e.target.value || todayKey)}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D192D] text-sm tabular-nums"
          />
          <div className="px-4 py-2 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 font-bold text-sm tabular-nums">
            درجة اليوم: {dayScore !== null ? `${dayScore.toFixed(1)} / 10` : 'غير مسجل'}
          </div>
        </div>
      </div>

      {/* 9 Criteria Grid */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Compass className="w-4 h-4 text-teal-500" />
          <span>المعايير التسعة لتقييم الاستجابة والاحترام</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {AXIS_META.obedience.defaultCriteria.map((c, i) => (
            <div
              key={c}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-700 dark:text-slate-300"
            >
              <span className="w-5 h-5 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span>{c}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300">
          <MessageSquareHeart className="w-4 h-4 shrink-0" />
          <span>
            مبدأ تربوي: السؤال والاستفسار أو التعبير عن الرأي بأدب حق أصيل للشخص ولا يُحسب جدالاً سلبياً.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        {appMode === 'guardian' && (
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4 h-fit"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>تسجيل موقف يومي جديد</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                المعيار المرتبط
              </label>
              <select
                value={criterionKey}
                onChange={(e) => setCriterionKey(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                {AXIS_META.obedience.defaultCriteria.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                وصف الموقف
              </label>
              <input
                type="text"
                required
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="مثال: وقت إغلاق الشاشات قبل النوم"
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                التوجيه الذي تم تقديمه
              </label>
              <input
                type="text"
                required
                value={guidanceGiven}
                onChange={(e) => setGuidanceGiven(e.target.value)}
                placeholder="مثال: طلبنا إنهاء اللعب والاستعداد للنوم بهدوء"
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                رد الفعل والنتيجة
              </label>
              <input
                type="text"
                required
                value={reaction}
                onChange={(e) => setReaction(e.target.value)}
                placeholder="مثال: استجاب بابتسامة وأغلق الجهاز فوراً"
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                نتيجة الاستجابة
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'positive', label: 'استجابة إيجابية' },
                  { id: 'partial', label: 'استجابة جزئية' },
                  { id: 'needs_support', label: 'يحتاج متابعة' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOutcome(opt.id as typeof outcome)}
                    className={`min-h-[40px] px-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      outcome === opt.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firstTimeResponse}
                  onChange={(e) => setFirstTimeResponse(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>استجاب من المرة الأولى</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={neededReminder}
                  onChange={(e) => setNeededReminder(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>احتاج إلى تذكير إضافي</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-teal-700 dark:text-teal-300">
                <input
                  type="checkbox"
                  checked={isPoliteQuestion}
                  onChange={(e) => setIsPoliteQuestion(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span>استفسر أو عبّر عن رأيه بأدب (حوار صحي)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                ملاحظات إضافية
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>

            {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors cursor-pointer"
            >
              {submitting ? 'جاري الحفظ...' : 'حفظ الموقف اليومي'}
            </button>
          </form>
        )}

        {/* Observations Timeline */}
        <div className={`${appMode === 'guardian' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            سجل المواقف ({dayObservations.length})
          </h3>

          {dayObservations.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
              لا توجد مواقف مسجلة لهذا التاريخ بعد.
            </div>
          ) : (
            dayObservations.map((obs) => (
              <div
                key={obs.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {obs.criterionKey}
                      {obs.isPoliteQuestion && ' · حوار واستفسار بأدب'}
                      {obs.firstTimeResponse && ' · استجابة من المرة الأولى'}
                    </div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">
                      {obs.situation}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold ${
                        obs.outcome === 'positive'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : obs.outcome === 'partial'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {obs.outcome === 'positive'
                        ? 'إيجابية'
                        : obs.outcome === 'partial'
                          ? 'جزئية'
                          : 'يحتاج متابعة'}
                    </span>
                    {appMode === 'guardian' && (
                      <button
                        type="button"
                        onClick={() => deleteObservation(uid, profile.id, obs.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="حذف السجل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">التوجيه:</strong> {obs.guidanceGiven}
                  </p>
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">رد الفعل:</strong> {obs.reaction}
                  </p>
                  {obs.notes && (
                    <p className="text-slate-500 dark:text-slate-400">ملاحظة: {obs.notes}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{obs.neededReminder ? 'احتاج إلى تذكير' : 'دون تذكير متكرر'}</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    <CheckCircle2 className="w-3.5 h-3.5" />+{obs.pointsAwarded} نقطة
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
