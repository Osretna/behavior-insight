import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Compass,
  Moon,
  Plus,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  AXIS_META,
  PRAYERS_META,
  type AppMode,
  type AxisKey,
  type AxisState,
  type BehaviorObservation,
  type DailyAssessment,
  type MonitoredProfile,
  type PrayerKey,
  type PrayerRecord,
  type PrayerStatus,
  type Responsibility,
  type StudySession,
  type TaskItem,
} from '../types/behavior';
import {
  addObservation,
  addStudySession,
  addTaskItem,
  approveTaskByGuardian,
  ensureDailyAssessment,
  ensureDailyTasksForDate,
  saveDailyAssessment,
  updateTaskProgress,
  upsertPrayerStatus,
} from '../lib/firestoreService';
import { computeWeightedTotal, deriveAxisState, getScoreClassification, getTodayDateKey } from '../lib/scoring';

export type QuickEvalTab = 'overall' | 'obedience' | 'study' | 'prayer' | 'responsibilities';

export function QuickEvaluatePanel({
  uid,
  profile,
  appMode,
  guardianName,
  todayAssessment,
  todayObs = [],
  todayStudy = [],
  todayPrayer,
  responsibilities,
  todayTasks,
  activeSubTab,
  onSubTabChange,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  guardianName: string;
  todayAssessment?: DailyAssessment;
  todayObs?: BehaviorObservation[];
  todayStudy?: StudySession[];
  todayPrayer: PrayerRecord | null;
  responsibilities: Responsibility[];
  todayTasks: TaskItem[];
  activeSubTab: QuickEvalTab;
  onSubTabChange: (tab: QuickEvalTab) => void;
}) {
  const todayKey = getTodayDateKey();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showManualSliders, setShowManualSliders] = useState(false);

  // Manual 1-10 fallback scoring state (only when user explicitly opens manual adjustment)
  const [directScores, setDirectScores] = useState<Record<AxisKey, number>>({
    obedience: 8,
    study: 8,
    prayer: 8,
    responsibilities: 8,
  });
  const [quickSummary, setQuickSummary] = useState('');

  // Quick Obedience state
  const [obCriterion, setObCriterion] = useState('الاستجابة عند طلب تنفيذ شيء');
  const [obNote, setObNote] = useState('');

  // Quick Study state
  const [studySubject, setStudySubject] = useState('القرآن الكريم');
  const [studyMinutes, setStudyMinutes] = useState(30);
  const [studyStars, setStudyStars] = useState(4);

  // Quick Task state
  const [quickTaskTitle, setQuickTaskTitle] = useState('');

  useEffect(() => {
    setDirectScores({
      obedience: todayAssessment?.scores.obedience ?? 8,
      study: todayAssessment?.scores.study ?? 8,
      prayer: todayAssessment?.scores.prayer ?? 8,
      responsibilities: todayAssessment?.scores.responsibilities ?? 8,
    });
    setQuickSummary(todayAssessment?.endOfDaySummary ?? '');
  }, [profile.id, todayAssessment?.scores.obedience, todayAssessment?.scores.study, todayAssessment?.scores.prayer, todayAssessment?.scores.responsibilities]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleSaveDirectScores = async () => {
    setBusy(true);
    try {
      await ensureDailyAssessment(uid, profile.id, todayKey);
      const total = computeWeightedTotal(directScores, profile.weights);
      const nextStates: Record<AxisKey, AxisState> = {
        obedience: deriveAxisState(directScores.obedience),
        study: deriveAxisState(directScores.study),
        prayer: deriveAxisState(directScores.prayer),
        responsibilities: deriveAxisState(directScores.responsibilities),
      };
      await saveDailyAssessment(
        uid,
        profile.id,
        todayKey,
        {
          status: 'finalized',
          axisStates: nextStates,
          scores: { ...directScores, total },
          dailyEvents: todayAssessment?.dailyEvents ?? '',
          endOfDaySummary: quickSummary.trim() || `تقييم مباشر لـ ${profile.name}`,
        },
        todayAssessment
      );
      showToast(`تم حفظ واعتماد تقييم ${profile.name} (${total?.toFixed(1) ?? '—'} / 10)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حفظ التقييم.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickObedience = async (outcome: 'positive' | 'partial' | 'needs_support', label: string, pts: number) => {
    setBusy(true);
    try {
      await addObservation(uid, profile.id, {
        dateKey: todayKey,
        situation: obCriterion,
        guidanceGiven: 'توجيه تربوي مباشر',
        reaction: obNote.trim() || label,
        outcome,
        firstTimeResponse: outcome === 'positive',
        neededReminder: outcome !== 'positive',
        criterionKey: obCriterion,
        isPoliteQuestion: false,
        pointsAwarded: pts,
        notes: obNote.trim(),
      });
      setObNote('');
      showToast(`تم تسجيل موقف «${label}» لـ ${profile.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تسجيل الموقف.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickStudy = async () => {
    setBusy(true);
    try {
      const now = new Date();
      const endStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const startDate = new Date(now.getTime() - studyMinutes * 60000);
      const startStr = startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      await addStudySession(uid, profile.id, {
        dateKey: todayKey,
        subject: studySubject,
        goalDescription: `مذاكرة ${studySubject} لمدة ${studyMinutes} دقيقة`,
        targetMinutes: studyMinutes,
        startTime: startStr,
        endTime: endStr,
        actualMinutes: studyMinutes,
        activityType: 'review',
        focusLevel: studyStars,
        qualityRating: studyStars,
        status: 'completed',
        postponeReason: '',
        notes: '',
      });
      showToast(`تم تسجيل ${studyMinutes} دقيقة مذاكرة في ${studySubject} لـ ${profile.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تسجيل المذاكرة.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickPrayer = async (prayerKey: PrayerKey, status: PrayerStatus) => {
    setBusy(true);
    try {
      await upsertPrayerStatus(uid, profile.id, todayKey, prayerKey, status, '', todayPrayer ?? undefined);
      const prayerName = PRAYERS_META.find((p) => p.key === prayerKey)?.nameAr || prayerKey;
      showToast(`تم تحديث صلاة ${prayerName} لـ ${profile.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحديث الصلاة.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTask = async (task: TaskItem) => {
    setBusy(true);
    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      if (appMode === 'guardian') {
        await approveTaskByGuardian(
          uid,
          profile.id,
          task.id,
          guardianName,
          nextStatus === 'completed',
          nextStatus,
          task.notes
        );
      } else {
        await updateTaskProgress(uid, profile.id, task.id, { status: nextStatus, notes: task.notes });
      }
      showToast(nextStatus === 'completed' ? `تم إنجاز «${task.title}»` : `تمت إعادة «${task.title}» لقيد التنفيذ`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحديث المهمة.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    setBusy(true);
    try {
      await addTaskItem(uid, profile.id, {
        responsibilityId: 'quick',
        dateKey: todayKey,
        title: quickTaskTitle.trim(),
        description: 'مهمة يومية سريعة',
        dueTime: '20:00',
        priority: 'medium',
        recurrence: 'daily',
        status: 'pending',
        guardianApproved: false,
        notes: '',
      });
      setQuickTaskTitle('');
      showToast('تمت إضافة المهمة لليوم');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إضافة المهمة.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateTasks = async () => {
    setBusy(true);
    try {
      await ensureDailyTasksForDate(uid, profile.id, todayKey, responsibilities, todayTasks);
      showToast('تم تجهيز مهام اليوم من القوالب المعتمدة.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر توليد المهام.');
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: QuickEvalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overall', label: 'التقييم التلقائي', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'obedience', label: 'سماع الكلام', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'study', label: 'المذاكرة', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'prayer', label: 'الصلاة', icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'responsibilities', label: 'المهام', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  ];

  const liveDirectTotal = computeWeightedTotal(directScores, profile.weights);
  const autoScores = todayAssessment?.scores ?? {
    obedience: null,
    study: null,
    prayer: null,
    responsibilities: null,
    total: null,
  };
  const autoClass = getScoreClassification(autoScores.total);
  const prayersDone = todayPrayer
    ? Object.values(todayPrayer.prayers).filter((p) => p.status !== 'unlogged').length
    : 0;
  const studyMins = todayStudy.reduce((sum, s) => sum + s.actualMinutes, 0);
  const completedTasksCount = todayTasks.filter((t) => t.status === 'completed').length;

  const autoAxisRows: {
    axis: AxisKey;
    tab: QuickEvalTab;
    score: number | null;
    evidence: string;
    actionLabel: string;
  }[] = [
    {
      axis: 'obedience',
      tab: 'obedience',
      score: autoScores.obedience,
      evidence: todayObs.length > 0 ? `محسوب من ${todayObs.length} موقف مسجل` : 'بانتظار تسجيل موقف',
      actionLabel: '+ تسجيل موقف',
    },
    {
      axis: 'study',
      tab: 'study',
      score: autoScores.study,
      evidence:
        todayStudy.length > 0
          ? `محسوب من ${todayStudy.length} جلسة (${studyMins} د)`
          : 'بانتظار جلسة مذاكرة',
      actionLabel: '+ تسجيل مذاكرة',
    },
    {
      axis: 'prayer',
      tab: 'prayer',
      score: autoScores.prayer,
      evidence: prayersDone > 0 ? `محسوب من ${prayersDone} من 5 صلوات` : 'بانتظار تسجيل صلاة',
      actionLabel: '+ تسجيل صلاة',
    },
    {
      axis: 'responsibilities',
      tab: 'responsibilities',
      score: autoScores.responsibilities,
      evidence:
        todayTasks.length > 0
          ? `محسوب من ${completedTasksCount} من ${todayTasks.length} مهمة`
          : 'بانتظار إنجاز مهمة',
      actionLabel: '+ متابعة المهام',
    },
  ];

  const handleFinalizeAutoScore = async () => {
    if (!todayAssessment) return;
    setBusy(true);
    try {
      await ensureDailyAssessment(uid, profile.id, todayKey);
      await saveDailyAssessment(
        uid,
        profile.id,
        todayKey,
        {
          status: 'finalized',
          axisStates: todayAssessment.axisStates,
          scores: todayAssessment.scores,
          dailyEvents: todayAssessment.dailyEvents,
          endOfDaySummary: quickSummary.trim() || todayAssessment.endOfDaySummary || `تقييم أوتوماتيكي لـ ${profile.name}`,
        },
        todayAssessment
      );
      showToast(`تم اعتماد التقييم التلقائي لـ ${profile.name} (${autoScores.total?.toFixed(1) ?? '—'} / 10)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر اعتماد التقييم.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="quick-evaluate-panel"
      className="rounded-3xl bg-white dark:bg-[#0D192D] border border-emerald-500/30 dark:border-emerald-500/25 shadow-sm overflow-hidden"
    >
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-l from-emerald-500/5 via-transparent to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <span
              style={{ backgroundColor: profile.avatarColor || '#0D9488' }}
              className="w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center"
            >
              {profile.name.slice(0, 1)}
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              التقييم التلقائي وسجلات {profile.name}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تُحتسب الدرجة من 1 إلى 10 أوتوماتيكياً فور إدخال أي موقف أو جلسة مذاكرة أو صلاة أو مهمة
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90">
          {tabs.map((t) => {
            if (t.id === 'overall' && appMode === 'tracked') return null;
            const active = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSubTabChange(t.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {toast && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* TAB 1: Automatic Live Evaluation Summary */}
        {activeSubTab === 'overall' && appMode === 'guardian' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-gradient-to-l from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  النتيجة التلقائية المحسوبة لـ {profile.name} اليوم
                </div>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {autoScores.total !== null ? autoScores.total.toFixed(1) : '—'}
                  </span>
                  <span className="text-sm text-slate-400">/ 10</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {autoClass.labelAr}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {autoScores.total !== null && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleFinalizeAutoScore}
                    className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد النتيجة التلقائية</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowManualSliders((p) => !p)}
                  className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {showManualSliders ? 'إخفاء التعديل اليدوي' : 'تعديل يدوي اختياري'}
                </button>
              </div>
            </div>

            {/* Live Automatic Breakdown per Axis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {autoAxisRows.map((row) => (
                <div
                  key={row.axis}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {AXIS_META[row.axis].titleAr}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {profile.weights[row.axis]}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1 tabular-nums">
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {row.score !== null ? row.score.toFixed(1) : '—'}
                      </span>
                      <span className="text-xs text-slate-400">/ 10</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {row.evidence}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSubTabChange(row.tab)}
                    className="w-full min-h-[34px] px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 text-xs font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer transition-colors"
                  >
                    {row.actionLabel}
                  </button>
                </div>
              ))}
            </div>

            {showManualSliders && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  تقدير يدوي مؤقت للمحاور التي لم تُسجل لها بيانات بعد:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((axis) => {
                    const val = directScores[axis];
                    return (
                      <div
                        key={axis}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {AXIS_META[axis].titleAr}
                          </div>
                          <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {val.toFixed(1)} / 10
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={0.5}
                          value={val}
                          onChange={(e) =>
                            setDirectScores((prev) => ({ ...prev, [axis]: Number(e.target.value) }))
                          }
                          className="w-full accent-emerald-600 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={quickSummary}
                    onChange={(e) => setQuickSummary(e.target.value)}
                    placeholder={`ملاحظة لـ ${profile.name} اليوم (اختياري)...`}
                    className="flex-1 min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveDirectScores}
                    className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{`حفظ التقدير اليدوي (${liveDirectTotal?.toFixed(1) ?? '—'}/10)`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Quick Obedience Logger */}
        {activeSubTab === 'obedience' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {AXIS_META.obedience.defaultCriteria.slice(0, 6).map((crit) => (
                <button
                  key={crit}
                  type="button"
                  onClick={() => setObCriterion(crit)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    obCriterion === crit
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {crit}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={obNote}
              onChange={(e) => setObNote(e.target.value)}
              placeholder={`وصف سريع للموقف مع ${profile.name} (اختياري)...`}
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleQuickObedience('positive', 'استجابة ممتازة وهادئة', 15)}
                className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                استجابة ممتازة من أول مرة (+15 نقطة)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleQuickObedience('partial', 'استجاب بعد تذكير لطيف', 7)}
                className="min-h-[48px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer"
              >
                استجابة جزئية / بعد تذكير (+7 نقاط)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleQuickObedience('needs_support', 'يحتاج توجيهاً ومتابعة', 2)}
                className="min-h-[48px] px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-bold text-xs sm:text-sm cursor-pointer"
              >
                لم يستجب / يحتاج دعماً
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Quick Study Session Logger */}
        {activeSubTab === 'study' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {['القرآن الكريم', 'اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنجليزية', 'مراجعة عامة'].map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setStudySubject(subj)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    studySubject === subj
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">المدة:</span>
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setStudyMinutes(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums cursor-pointer ${
                      studyMinutes === m
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m} د
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">التركيز:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setStudyStars(star)}
                    className="p-1 cursor-pointer"
                    aria-label={`${star} نجوم`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= studyStars ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleQuickStudy}
                className="min-h-[42px] px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تسجيل جلسة المذاكرة</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Quick 5 Prayers */}
        {activeSubTab === 'prayer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {PRAYERS_META.map((pm) => {
              const pk = pm.key;
              const current = todayPrayer?.prayers[pk]?.status ?? 'unlogged';
              return (
                <div
                  key={pk}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{pm.nameAr}</span>
                    <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                      {current === 'on_time'
                        ? 'في وقتها'
                        : current === 'late'
                          ? 'متأخرة'
                          : current === 'missed'
                            ? 'فاتت'
                            : 'غير مسجلة'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { st: 'on_time', label: 'وقتها', cls: 'bg-emerald-600 text-white' },
                        { st: 'late', label: 'قضاء', cls: 'bg-amber-500 text-slate-950' },
                        { st: 'missed', label: 'فاتت', cls: 'bg-rose-600 text-white' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.st}
                        type="button"
                        disabled={busy}
                        onClick={() => handleQuickPrayer(pk, opt.st)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          current === opt.st
                            ? opt.cls
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 5: Quick Responsibilities & Tasks */}
        {activeSubTab === 'responsibilities' && (
          <div className="space-y-4">
            <form onSubmit={handleAddQuickTask} className="flex gap-2">
              <input
                type="text"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder={`أضف مهمة سريعة لـ ${profile.name} اليوم...`}
                className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </form>

            {todayTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  لا توجد مهام مجدولة اليوم بعد لـ {profile.name}.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGenerateTasks}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  توليد المهام اليومية المعتادة
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {todayTasks.map((task) => {
                  const done = task.status === 'completed';
                  return (
                    <button
                      key={task.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleTask(task)}
                      className={`p-3.5 rounded-xl border text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        done
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className={`text-xs sm:text-sm font-semibold ${done ? 'line-through opacity-80' : ''}`}>
                        {task.title}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                          done
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {done ? 'مكتملة ✓' : 'تحديد كمكتملة'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
