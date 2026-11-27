import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, Save } from 'lucide-react';
import {
  AXIS_META,
  type AxisKey,
  type BehaviorObservation,
  type BehaviorReport,
  type DailyAssessment,
  type MonitoredProfile,
  type PrayerRecord,
  type StudySession,
  type TaskItem,
} from '../types/behavior';
import {
  averageScoresOverDays,
  formatArabicGregorian,
  formatHijriDate,
  getOffsetDateKey,
  getScoreClassification,
  getTodayDateKey,
} from '../lib/scoring';
import { saveBehaviorReport } from '../lib/firestoreService';
import { ScoreLineChart, WeeklyBarChart } from './Charts';

export function ReportsView({
  uid,
  profile,
  assessments,
  observations,
  studySessions,
  prayerRecords,
  tasks,
  savedReports,
}: {
  uid: string;
  profile: MonitoredProfile;
  assessments: DailyAssessment[];
  observations: BehaviorObservation[];
  studySessions: StudySession[];
  prayerRecords: PrayerRecord[];
  tasks: TaskItem[];
  savedReports: BehaviorReport[];
}) {
  const todayKey = getTodayDateKey();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [refDate, setRefDate] = useState(todayKey);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const days = reportType === 'daily' ? 1 : reportType === 'weekly' ? 7 : 30;
  const periodStart = getOffsetDateKey(-(days - 1), refDate);
  const periodEnd = refDate;

  const periodAssessments = useMemo(
    () =>
      assessments
        .filter((a) => a.dateKey >= periodStart && a.dateKey <= periodEnd)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    [assessments, periodStart, periodEnd]
  );

  const periodObs = observations.filter((o) => o.dateKey >= periodStart && o.dateKey <= periodEnd);
  const periodStudy = studySessions.filter((s) => s.dateKey >= periodStart && s.dateKey <= periodEnd);
  const periodPrayers = prayerRecords.filter((p) => p.dateKey >= periodStart && p.dateKey <= periodEnd);
  const periodTasks = tasks.filter((t) => t.dateKey >= periodStart && t.dateKey <= periodEnd);

  const axisAverages = useMemo(() => {
    const avg = (axis: AxisKey): number | null => {
      const vals = periodAssessments
        .map((a) => a.scores[axis])
        .filter((v): v is number => v !== null && Number.isFinite(v));
      if (vals.length === 0) return null;
      return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
    };
    return {
      obedience: avg('obedience'),
      study: avg('study'),
      prayer: avg('prayer'),
      responsibilities: avg('responsibilities'),
    };
  }, [periodAssessments]);

  const overallAverage = useMemo(() => {
    const vals = periodAssessments
      .map((a) => a.scores.total)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
  }, [periodAssessments]);

  const prevPeriodAvg = useMemo(() => {
    const prevEnd = getOffsetDateKey(-1, periodStart);
    return averageScoresOverDays(assessments, days, prevEnd);
  }, [assessments, days, periodStart]);

  const rankedAxes = (['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[])
    .filter((k) => axisAverages[k] !== null)
    .sort((a, b) => (axisAverages[b] ?? 0) - (axisAverages[a] ?? 0));

  const strongestAxis = rankedAxes[0] ? AXIS_META[rankedAxes[0]].titleAr : 'غير محدد بعد';
  const weakestAxis = rankedAxes[rankedAxes.length - 1]
    ? AXIS_META[rankedAxes[rankedAxes.length - 1]].titleAr
    : 'غير محدد بعد';

  const completedTasksCount = periodTasks.filter((t) => t.status === 'completed').length;
  const totalStudyMins = periodStudy.reduce((sum, s) => sum + s.actualMinutes, 0);
  const prayersOnTime = periodPrayers.reduce(
    (sum, rec) => sum + Object.values(rec.prayers).filter((p) => p.status === 'on_time').length,
    0
  );
  const prayersTotalLogged = periodPrayers.reduce(
    (sum, rec) => sum + Object.values(rec.prayers).filter((p) => p.status !== 'unlogged').length,
    0
  );

  const classification = getScoreClassification(overallAverage);

  const chartData = useMemo(() => {
    const map = new Map(periodAssessments.map((a) => [a.dateKey, a.scores.total]));
    const list: { dateKey: string; label: string; score: number | null }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dk = getOffsetDateKey(-i, periodEnd);
      list.push({ dateKey: dk, label: dk.slice(5), score: map.get(dk) ?? null });
    }
    return list;
  }, [periodAssessments, days, periodEnd]);

  const handleSaveSnapshot = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await saveBehaviorReport(uid, profile.id, {
        reportType,
        periodStart,
        periodEnd,
        averageScore: overallAverage ?? 0,
        axisAverages,
        highlights: `أقوى محور: ${strongestAxis}. يحتاج لمتابعة: ${weakestAxis}. دقائق المذاكرة: ${totalStudyMins}. المهام المنجزة: ${completedTasksCount}/${periodTasks.length}.`,
      });
      setFeedback('تم حفظ نسخة من التقرير في الأرشيف بنجاح.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر حفظ التقرير.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcelCsv = () => {
    const headers = [
      'التاريخ',
      'الحالة',
      'سماع الكلام',
      'المذاكرة',
      'الصلاة',
      'الواجبات والمسؤوليات',
      'الدرجة الإجمالية',
      'ملاحظات اليوم',
    ];
    const rows = periodAssessments.map((a) => [
      a.dateKey,
      a.status === 'finalized' ? 'معتمد' : 'مسودة',
      a.scores.obedience ?? '',
      a.scores.study ?? '',
      a.scores.prayer ?? '',
      a.scores.responsibilities ?? '',
      a.scores.total ?? '',
      `"${(a.endOfDaySummary || a.dailyEvents || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `behavior-insight-${reportType}-${periodEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintOrPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">مركز التقارير الاحترافية</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            تقارير يومية وأسبوعية وشهرية قابلة للطباعة والتصدير إلى PDF وExcel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
            {[
              { id: 'daily', label: 'تقرير يومي' },
              { id: 'weekly', label: 'تقرير أسبوعي' },
              { id: 'monthly', label: 'تقرير شهري' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReportType(t.id as typeof reportType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  reportType === t.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={refDate}
            max={todayKey}
            onChange={(e) => setRefDate(e.target.value || todayKey)}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D192D] text-xs tabular-nums"
          />

          <button
            type="button"
            onClick={handleExportExcelCsv}
            className="min-h-[40px] px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrintOrPdf}
            className="min-h-[40px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة / PDF</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveSnapshot}
            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التقرير</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300 no-print">
          {feedback}
        </div>
      )}

      {/* Printable Report Sheet */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              BEHAVIOR INSIGHT · نحو سلوك أفضل.. يوم بعد يوم
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {reportType === 'daily'
                ? 'التقرير السلوكي اليومي'
                : reportType === 'weekly'
                  ? 'التقرير السلوكي الأسبوعي'
                  : 'التقرير السلوكي الشهري'}{' '}
              — {profile.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              الفترة: {periodStart} إلى {periodEnd} · {formatArabicGregorian(periodEnd)}{' '}
              {formatHijriDate(periodEnd) && `(${formatHijriDate(periodEnd)})`}
            </p>
          </div>

          <div className="text-left">
            <div className="text-xs text-slate-500 dark:text-slate-400">متوسط الدرجة الإجمالية</div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {overallAverage !== null ? overallAverage.toFixed(1) : '—'}{' '}
              <span className="text-sm font-normal text-slate-400">/ 10</span>
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {classification.labelAr}
            </div>
          </div>
        </div>

        {/* 4 Axis Averages */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print-break-inside-avoid">
          {(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((axis) => (
            <div
              key={axis}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{AXIS_META[axis].titleAr}</div>
              <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                {axisAverages[axis] !== null ? `${axisAverages[axis]!.toFixed(1)}` : '—'}
                <span className="text-xs font-normal text-slate-400"> / 10</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm print-break-inside-avoid">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white">نقاط القوة ومقارنة الفترة السابقة</h4>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
              • المحور الأكثر التزاماً: <strong>{strongestAxis}</strong>
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
              • المحور الذي يحتاج إلى متابعة إضافية: <strong>{weakestAxis}</strong>
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm tabular-nums">
              • مقارنة بالفترة السابقة:{' '}
              {prevPeriodAvg !== null && overallAverage !== null
                ? overallAverage >= prevPeriodAvg
                  ? `تحسن بمقدار +${(overallAverage - prevPeriodAvg).toFixed(1)} نقطة`
                  : `تراجع طفيف بمقدار ${(overallAverage - prevPeriodAvg).toFixed(1)} نقطة`
                : 'لا توجد بيانات كافية للفترة السابقة'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white">ملخص الإنجاز الفعلي</h4>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm tabular-nums">
              • مواقف سماع الكلام المسجلة: {periodObs.length} موقفاً
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm tabular-nums">
              • المذاكرة: {periodStudy.length} جلسة بإجمالي {totalStudyMins} دقيقة
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm tabular-nums">
              • الصلاة: {prayersOnTime} صلاة في وقتها من أصل {prayersTotalLogged} مسجلة
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm tabular-nums">
              • المسؤوليات المنجزة: {completedTasksCount} من {periodTasks.length} مهمة
            </p>
          </div>
        </div>

        {/* Performance Curve */}
        {reportType !== 'daily' && (
          <div className="print-break-inside-avoid">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">منحنى تطور الأداء</h4>
            <ScoreLineChart data={chartData} />
          </div>
        )}

        {/* Axis Comparison Bar Chart */}
        <div className="print-break-inside-avoid">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">مقارنة المحاور الأربعة</h4>
          <WeeklyBarChart
            bars={(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((k) => ({
              label: AXIS_META[k].titleAr,
              value: axisAverages[k],
              color: AXIS_META[k].accentColor,
            }))}
          />
        </div>
      </div>

      {/* Saved Reports Archive */}
      {savedReports.length > 0 && (
        <section className="p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-3 no-print">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>أرشيف التقارير المحفوظة ({savedReports.length})</span>
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {savedReports.map((rep) => (
              <div key={rep.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {rep.reportType === 'daily'
                      ? 'تقرير يومي'
                      : rep.reportType === 'weekly'
                        ? 'تقرير أسبوعي'
                        : 'تقرير شهري'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mr-2 tabular-nums">
                    ({rep.periodStart} — {rep.periodEnd})
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{rep.highlights}</p>
                </div>
                <div className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {rep.averageScore.toFixed(1)} / 10
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
