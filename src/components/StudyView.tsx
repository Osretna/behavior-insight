import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Pause, Play, Plus, RotateCcw, Timer, Trash2 } from 'lucide-react';
import type { AppMode, MonitoredProfile, StudySession } from '../types/behavior';
import { addStudySession, deleteStudySession } from '../lib/firestoreService';
import { computeStudyScore, getTodayDateKey } from '../lib/scoring';

export function StudyView({
  uid,
  profile,
  appMode,
  sessions,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  sessions: StudySession[];
}) {
  const todayKey = getTodayDateKey();
  const [dateFilter, setDateFilter] = useState(todayKey);

  // Focus Timer State
  const [timerSubject, setTimerSubject] = useState('الرياضيات');
  const [timerGoal, setTimerGoal] = useState('مذاكرة الرياضيات لمدة 45 دقيقة');
  const [targetMinutes, setTargetMinutes] = useState(45);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string>('');

  // Manual Session Form State
  const [subject, setSubject] = useState('اللغة العربية');
  const [goalDescription, setGoalDescription] = useState('');
  const [activityType, setActivityType] = useState<StudySession['activityType']>('review');
  const [manualTargetMin, setManualTargetMin] = useState(30);
  const [actualMinutes, setActualMinutes] = useState(30);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('16:30');
  const [focusLevel, setFocusLevel] = useState(4);
  const [qualityRating, setQualityRating] = useState(4);
  const [status, setStatus] = useState<StudySession['status']>('completed');
  const [postponeReason, setPostponeReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const handleToggleTimer = () => {
    if (!isRunning && !timerStartedAt) {
      setTimerStartedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }
    setIsRunning((prev) => !prev);
  };

  const handleResetTimer = (mins: number) => {
    setIsRunning(false);
    setTargetMinutes(mins);
    setSecondsLeft(mins * 60);
    setTimerStartedAt('');
  };

  const handleCompleteTimerSession = async () => {
    setIsRunning(false);
    const elapsedMin = Math.max(1, Math.round((targetMinutes * 60 - secondsLeft) / 60));
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setSaving(true);
    try {
      await addStudySession(uid, profile.id, {
        dateKey: todayKey,
        subject: timerSubject,
        goalDescription: timerGoal || `مذاكرة ${timerSubject}`,
        targetMinutes,
        startTime: timerStartedAt || nowTime,
        endTime: nowTime,
        actualMinutes: elapsedMin,
        activityType: 'review',
        focusLevel,
        qualityRating,
        status: elapsedMin >= targetMinutes * 0.8 ? 'completed' : 'partial',
        postponeReason: '',
        notes: 'تم التسجيل عبر مؤقت التركيز الذكي',
      });
      handleResetTimer(targetMinutes);
      setFeedback('تم تسجيل جلسة المذاكرة من المؤقت بنجاح!');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر تسجيل الجلسة.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !goalDescription.trim()) return;
    if (status === 'postponed' && !postponeReason.trim()) {
      setFeedback('يرجى ذكر سبب تأجيل الجلسة.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await addStudySession(uid, profile.id, {
        dateKey: dateFilter,
        subject,
        goalDescription,
        targetMinutes: manualTargetMin,
        startTime,
        endTime,
        actualMinutes,
        activityType,
        focusLevel,
        qualityRating,
        status,
        postponeReason,
        notes,
      });
      setGoalDescription('');
      setPostponeReason('');
      setNotes('');
      setFeedback('تم حفظ جلسة المذاكرة بنجاح.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const minsDisplay = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secsDisplay = String(secondsLeft % 60).padStart(2, '0');

  const daySessions = sessions.filter((s) => s.dateKey === dateFilter);
  const totalDayMinutes = daySessions.reduce((sum, s) => sum + s.actualMinutes, 0);
  const dayScore = computeStudyScore(daySessions, 'unrated');

  const quickGoalPresets = [
    { subject: 'الرياضيات', goal: 'مذاكرة الرياضيات لمدة 45 دقيقة', mins: 45 },
    { subject: 'اللغة العربية', goal: 'مراجعة اللغة العربية وقواعد النحو', mins: 30 },
    { subject: 'العلوم', goal: 'حل 20 سؤالاً ومراجعة درس سابق', mins: 35 },
    { subject: 'القرآن الكريم', goal: 'مراجعة الحفظ والتلاوة اليومية', mins: 25 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            المحور الثاني: المذاكرة والالتزام بالتعلم
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            متابعة الأهداف الدراسية، مؤقت التركيز، وتقييم جودة المذاكرة وليس الوقت فقط
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
          <div className="px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-700 dark:text-sky-300 font-bold text-sm tabular-nums">
            {dayScore !== null ? `${dayScore.toFixed(1)} / 10` : 'غير مسجل'} · {totalDayMinutes} د
          </div>
        </div>
      </div>

      {/* Focus Timer Card */}
      <section className="p-6 rounded-2xl bg-gradient-to-l from-[#0C1D37] to-[#0E3140] text-white border border-sky-500/20 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 text-center lg:text-right space-y-2">
            <div className="inline-flex items-center gap-2 text-xs text-sky-300 font-medium">
              <Timer className="w-4 h-4" />
              <span>مؤقت المذاكرة والتركيز (Focus Timer)</span>
            </div>
            <div className="text-5xl sm:text-6xl font-mono font-bold tabular-nums tracking-tight text-white py-2">
              {minsDisplay}:{secsDisplay}
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <button
                type="button"
                onClick={handleToggleTimer}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isRunning ? 'إيقاف مؤقت' : 'بدء المذاكرة'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleResetTimer(targetMinutes)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleCompleteTimerSession}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>إنهاء وحفظ الجلسة</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">المادة الدراسية</label>
                <input
                  type="text"
                  value={timerSubject}
                  onChange={(e) => setTimerSubject(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/10 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">المدة المستهدفة (دقائق)</label>
                <div className="flex items-center gap-1.5">
                  {[25, 35, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleResetTimer(m)}
                      className={`flex-1 min-h-[42px] rounded-xl text-xs font-mono font-bold cursor-pointer ${
                        targetMinutes === m ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-white'
                      }`}
                    >
                      {m} د
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">هدف الجلسة</label>
              <input
                type="text"
                value={timerGoal}
                onChange={(e) => setTimerGoal(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-white/10 border border-white/15 text-sm text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {quickGoalPresets.map((p) => (
                <button
                  key={p.goal}
                  type="button"
                  onClick={() => {
                    setTimerSubject(p.subject);
                    setTimerGoal(p.goal);
                    handleResetTimer(p.mins);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 cursor-pointer"
                >
                  {p.goal}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Manual Session Logger */}
        <form
          onSubmit={handleManualSubmit}
          className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4 h-fit"
        >
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-500" />
            <span>تسجيل هدف وجلسة مذاكرة</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">المادة</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">النشاط</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as StudySession['activityType'])}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              >
                <option value="homework">الواجبات المدرسية</option>
                <option value="review">مراجعة الدروس</option>
                <option value="exercises">حل التدريبات</option>
                <option value="reading">قراءة واستيعاب</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الهدف المطلوب</label>
            <input
              type="text"
              required
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              placeholder="مثال: حل 20 سؤالاً في الكسور"
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">وقت البدء</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[40px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الانتهاء</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[40px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">المحدد (د)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={manualTargetMin}
                onChange={(e) => setManualTargetMin(Number(e.target.value))}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الفعلي (د)</label>
              <input
                type="number"
                min={0}
                max={300}
                value={actualMinutes}
                onChange={(e) => setActualMinutes(Number(e.target.value))}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                مستوى التركيز ({focusLevel}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={focusLevel}
                onChange={(e) => setFocusLevel(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                جودة المذاكرة ({qualityRating}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={qualityRating}
                onChange={(e) => setQualityRating(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1.5">نتيجة الجلسة</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'completed', label: 'مكتمل' },
                { id: 'partial', label: 'مكتمل جزئياً' },
                { id: 'incomplete', label: 'لم يكتمل' },
                { id: 'postponed', label: 'مؤجل مع ذكر السبب' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id as StudySession['status'])}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                    status === opt.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'postponed' && (
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">سبب التأجيل</label>
              <input
                type="text"
                required
                value={postponeReason}
                onChange={(e) => setPostponeReason(e.target.value)}
                placeholder="اذكر سبب التأجيل بوضوح..."
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
          )}

          {feedback && <p className="text-xs text-emerald-600 dark:text-emerald-400">{feedback}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[46px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors cursor-pointer"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ جلسة المذاكرة'}
          </button>
        </form>

        {/* Sessions List */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-500" />
            <span>جدول وجلسات اليوم ({daySessions.length})</span>
          </h3>

          {daySessions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
              لا توجد جلسات مذاكرة مسجلة لهذا التاريخ. استخدم مؤقت التركيز أو أضف جلسة جديدة.
            </div>
          ) : (
            daySessions.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mb-1">
                      {s.subject} · {s.startTime} - {s.endTime} · {s.actualMinutes} دقيقة فعلية (من {s.targetMinutes} د)
                    </div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{s.goalDescription}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        s.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : s.status === 'partial'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {s.status === 'completed'
                        ? 'مكتمل'
                        : s.status === 'partial'
                          ? 'مكتمل جزئياً'
                          : s.status === 'postponed'
                            ? 'مؤجل'
                            : 'لم يكتمل'}
                    </span>
                    {appMode === 'guardian' && (
                      <button
                        type="button"
                        onClick={() => deleteStudySession(uid, profile.id, s.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  <span>التركيز: {s.focusLevel}/5</span>
                  <span>الجودة: {s.qualityRating}/5</span>
                  {s.postponeReason && (
                    <span className="text-amber-600 dark:text-amber-400">سبب التأجيل: {s.postponeReason}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
