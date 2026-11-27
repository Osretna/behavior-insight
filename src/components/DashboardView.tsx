import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  Flame,
  Moon,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  AXIS_META,
  type AppMode,
  type AppTab,
  type AxisKey,
  type BehaviorObservation,
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
import {
  AxisRadarChart,
  CalendarHeatmap,
  ProgressRing,
  ScoreLineChart,
  WeeklyBarChart,
} from './Charts';
import { IslamicGeometricHeaderBackdrop } from './IslamicDecor';

export function DashboardView({
  profile,
  appMode,
  assessments,
  observations,
  studySessions,
  prayerRecords,
  tasks,
  onNavigate,
}: {
  profile: MonitoredProfile;
  appMode: AppMode;
  assessments: DailyAssessment[];
  observations: BehaviorObservation[];
  studySessions: StudySession[];
  prayerRecords: PrayerRecord[];
  tasks: TaskItem[];
  onNavigate: (tab: AppTab) => void;
}) {
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(14);
  const todayKey = getTodayDateKey();
  const gregorian = formatArabicGregorian(todayKey);
  const hijri = formatHijriDate(todayKey);

  const todayAssessment = assessments.find((a) => a.dateKey === todayKey);
  const todayTasks = tasks.filter((t) => t.dateKey === todayKey);
  const completedTasks = todayTasks.filter((t) => t.status === 'completed').length;
  const incompleteTasks = todayTasks.filter((t) => t.status !== 'completed').length;

  const todayPrayer = prayerRecords.find((p) => p.dateKey === todayKey);
  const prayersLoggedCount = todayPrayer
    ? Object.values(todayPrayer.prayers).filter((p) => p.status === 'on_time' || p.status === 'late').length
    : 0;

  const todayStudy = studySessions.filter((s) => s.dateKey === todayKey);
  const studyMinutesToday = todayStudy.reduce((sum, s) => sum + s.actualMinutes, 0);
  const todayObs = observations.filter((o) => o.dateKey === todayKey);

  const weeklyAvg = averageScoresOverDays(assessments, 7, todayKey);
  const monthlyAvg = averageScoresOverDays(assessments, 30, todayKey);

  const todayScores = todayAssessment?.scores ?? {
    obedience: null,
    study: null,
    prayer: null,
    responsibilities: null,
    total: null,
  };

  const classification = getScoreClassification(todayScores.total);
  const ratedAxesCount = (['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).filter(
    (k) => todayScores[k] !== null
  ).length;
  const dailyCommitmentPct =
    todayScores.total !== null
      ? Math.round((todayScores.total / 10) * 100)
      : Math.round((ratedAxesCount / 4) * 100);

  const lineData = useMemo(() => {
    const map = new Map(assessments.map((a) => [a.dateKey, a.scores.total]));
    const arr: { dateKey: string; label: string; score: number | null }[] = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const dk = getOffsetDateKey(-i, todayKey);
      arr.push({
        dateKey: dk,
        label: dk.slice(5),
        score: map.get(dk) ?? null,
      });
    }
    return arr;
  }, [assessments, chartDays, todayKey]);

  const weeklyBars = useMemo(() => {
    const map = new Map(assessments.map((a) => [a.dateKey, a.scores.total]));
    const arr: { label: string; value: number | null; color: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dk = getOffsetDateKey(-i, todayKey);
      const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(
        new Date(`${dk}T12:00:00`)
      );
      const val = map.get(dk) ?? null;
      arr.push({
        label: dayName,
        value: val,
        color: val !== null && val >= 8 ? '#10B981' : val !== null && val >= 6 ? '#0D9488' : '#C8A24A',
      });
    }
    return arr;
  }, [assessments, todayKey]);

  const axisCards: {
    key: AxisKey;
    tab: AppTab;
    icon: React.ReactNode;
    score: number | null;
    pct: number;
    statusText: string;
    color: string;
  }[] = [
    {
      key: 'obedience',
      tab: 'obedience',
      icon: <Compass className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
      score: todayScores.obedience,
      pct:
        todayScores.obedience !== null
          ? Math.round(todayScores.obedience * 10)
          : todayObs.length > 0
            ? 100
            : 0,
      statusText:
        todayObs.length > 0
          ? `${todayObs.length} موقف مسجل اليوم`
          : todayScores.obedience !== null
            ? 'تم التقييم اليومي'
            : 'في انتظار التسجيل',
      color: '#0D9488',
    },
    {
      key: 'study',
      tab: 'study',
      icon: <BookOpen className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
      score: todayScores.study,
      pct:
        profile.dailyGoalMinutes > 0
          ? Math.min(100, Math.round((studyMinutesToday / profile.dailyGoalMinutes) * 100))
          : 0,
      statusText:
        todayStudy.length > 0
          ? `${studyMinutesToday} دقيقة من ${profile.dailyGoalMinutes} د`
          : 'لم تبدأ جلسة مذاكرة اليوم',
      color: '#2563EB',
    },
    {
      key: 'prayer',
      tab: 'prayer',
      icon: <Moon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      score: todayScores.prayer,
      pct: Math.round((prayersLoggedCount / 5) * 100),
      statusText: `${prayersLoggedCount} من 5 صلوات مسجلة اليوم`,
      color: '#10B981',
    },
    {
      key: 'responsibilities',
      tab: 'responsibilities',
      icon: <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      score: todayScores.responsibilities,
      pct: todayTasks.length > 0 ? Math.round((completedTasks / todayTasks.length) * 100) : 0,
      statusText:
        todayTasks.length > 0
          ? `${completedTasks} من ${todayTasks.length} مهمة مكتملة`
          : 'لا توجد مهام مجدولة اليوم',
      color: '#C8A24A',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Summary Card with Islamic Geometric Backdrop */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <IslamicGeometricHeaderBackdrop />
        <div className="relative z-10 p-6 sm:p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200/90">
                <Calendar className="w-3.5 h-3.5" />
                <span>{gregorian}</span>
                {hijri && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{hijri}</span>
                  </>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {appMode === 'tracked' ? `أهلاً ${profile.name}، يوم مبارك ومثمر` : `لوحة متابعة: ${profile.name}`}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-200">
                <span>
                  حالة التقييم اليومي:{' '}
                  <strong className="text-white">
                    {todayAssessment?.status === 'finalized'
                      ? 'معتمد ومكتمل'
                      : todayAssessment
                        ? 'قيد المتابعة (مسودة)'
                        : 'لم يبدأ بعد'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  التصنيف الحالي: <strong className="text-amber-300">{classification.labelAr}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3">
                <ProgressRing
                  percentage={dailyCommitmentPct}
                  size={56}
                  strokeWidth={5}
                  color="#34D399"
                  label={`${dailyCommitmentPct}%`}
                />
                <div>
                  <div className="text-xs text-slate-200">نسبة الالتزام اليومية</div>
                  <div className="text-xl font-bold tabular-nums text-white">
                    {todayScores.total !== null ? `${todayScores.total.toFixed(1)} / 10` : '— / 10'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('assessment')}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{appMode === 'guardian' ? 'التقييم اليومي' : 'عرض يومي'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary KPI Strip (5 metrics in clean grid) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>سلسلة الالتزام</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {profile.activeStreak} <span className="text-xs font-normal text-slate-500">أيام متتالية</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>المهام المكتملة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {completedTasks}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>المهام غير المكتملة</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {incompleteTasks}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>متوسط الأسبوع</span>
            <TrendingUp className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {weeklyAvg !== null ? `${weeklyAvg.toFixed(1)}` : '—'} <span className="text-xs font-normal text-slate-500">/ 10</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>متوسط الشهر</span>
            <Star className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {monthlyAvg !== null ? `${monthlyAvg.toFixed(1)}` : '—'} <span className="text-xs font-normal text-slate-500">/ 10</span>
          </div>
        </div>
      </section>

      {/* Four Main Axes Cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">المحاور الأربعة الرئيسية</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            تقييم مستقل من 1 إلى 10 لكل محور
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {axisCards.map((card) => {
            const meta = AXIS_META[card.key];
            const weight = profile.weights[card.key];
            return (
              <div
                key={card.key}
                className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90 flex flex-col justify-between gap-4 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {card.icon}
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">
                        {meta.titleAr}
                      </h4>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      الوزن: {weight}% <span aria-hidden="true">·</span> {card.statusText}
                    </div>
                  </div>
                  <ProgressRing
                    percentage={card.pct}
                    size={50}
                    strokeWidth={4.5}
                    color={card.color}
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">الدرجة</span>
                    <span className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                      {card.score !== null ? `${card.score.toFixed(1)}` : '—'}
                      <span className="text-xs font-normal text-slate-400"> / 10</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(card.tab)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>عرض التفاصيل</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Analytics Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">توازن المحاور الأربعة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">مقارنة بصرية لدرجات اليوم</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ai')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>التحليل الذكي</span>
            </button>
          </div>
          <AxisRadarChart
            scores={{
              obedience: todayScores.obedience,
              study: todayScores.study,
              prayer: todayScores.prayer,
              responsibilities: todayScores.responsibilities,
            }}
          />
        </div>

        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">تطور الدرجات اليومية</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">منحنى الأداء عبر الفترة المختارة</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setChartDays(d)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    chartDays === d
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {d} يوم
                </button>
              ))}
            </div>
          </div>

          <ScoreLineChart data={lineData} />
        </div>

        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">مقارنة الأداء الأسبوعي</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">متوسط كل يوم خلال آخر 7 أيام</p>
          <WeeklyBarChart bars={weeklyBars} />
        </div>

        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800/90">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">سجل الالتزام التراكمي</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">انقر على أي يوم لاستعراض درجته</p>
          <CalendarHeatmap assessments={assessments} endDateKey={todayKey} days={35} />
        </div>
      </section>
    </div>
  );
}
