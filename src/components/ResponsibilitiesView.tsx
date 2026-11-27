import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, CheckSquare, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { AppMode, MonitoredProfile, Responsibility, TaskItem } from '../types/behavior';
import {
  addResponsibility,
  addTaskItem,
  approveTaskByGuardian,
  deleteTaskItem,
  ensureDailyTasksForDate,
  toggleResponsibilityActive,
  updateTaskProgress,
} from '../lib/firestoreService';
import { computeResponsibilitiesScore, getTodayDateKey } from '../lib/scoring';

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 720;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة الصورة.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => reject(new Error('ملف الصورة غير صالح.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
    reader.readAsDataURL(file);
  });
}

export function ResponsibilitiesView({
  uid,
  profile,
  appMode,
  guardianName,
  responsibilities,
  tasks,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  guardianName: string;
  responsibilities: Responsibility[];
  tasks: TaskItem[];
}) {
  const todayKey = getTodayDateKey();
  const [dateKey, setDateKey] = useState(todayKey);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('18:00');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [requiresProof, setRequiresProof] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (dateKey === todayKey && responsibilities.length > 0) {
      ensureDailyTasksForDate(uid, profile.id, dateKey, responsibilities, tasks).catch(() => {});
    }
  }, [uid, profile.id, dateKey, responsibilities.length]);

  const dayTasks = tasks.filter((t) => t.dateKey === dateKey);
  const dayScore = computeResponsibilitiesScore(dayTasks, 'unrated');

  const handleAddResponsibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const respId = await addResponsibility(uid, profile.id, {
        title,
        description,
        dueTime,
        priority,
        recurrence,
        requiresProof,
        active: true,
      });
      await addTaskItem(uid, profile.id, {
        responsibilityId: respId,
        dateKey,
        title,
        description,
        dueTime,
        priority,
        recurrence,
        status: 'pending',
        guardianApproved: false,
        notes: '',
      });
      setTitle('');
      setDescription('');
      setFeedback('تمت إضافة المسؤولية وجدولتها لليوم بنجاح.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر الإضافة.');
    } finally {
      setSaving(false);
    }
  };

  const handleProofUpload = async (task: TaskItem, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > 190000) {
        setFeedback('حجم الصورة كبير جداً بعد الضغط، يرجى اختيار صورة أصغر.');
        return;
      }
      await updateTaskProgress(uid, profile.id, task.id, {
        status: task.status === 'pending' ? 'completed' : task.status,
        notes: task.notes,
        proofImageDataUrl: dataUrl,
      });
      setFeedback('تم إرفاق صورة إثبات الإنجاز بنجاح.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر إرفاق الصورة.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            المحور الرابع: الواجبات والمسؤوليات
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            إدارة المهام اليومية والمتكررة، إرفاق إثبات التنفيذ، واعتماد ولي الأمر
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateKey}
            max={todayKey}
            onChange={(e) => setDateKey(e.target.value || todayKey)}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D192D] text-sm tabular-nums"
          />
          <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-sm tabular-nums">
            {dayScore !== null ? `${dayScore.toFixed(1)} / 10` : 'غير مسجل'}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add New Responsibility (Guardian Mode) */}
        {appMode === 'guardian' && (
          <div className="lg:col-span-4 space-y-5">
            <form
              onSubmit={handleAddResponsibility}
              className="p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>إضافة مسؤولية جديدة</span>
              </h3>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">اسم المهمة</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: ترتيب المكتبة أو المحافظة على الممتلكات"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="تفاصيل تنفيذ المهمة..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الموعد</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full min-h-[40px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الأولوية</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    className="w-full min-h-[40px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  >
                    <option value="high">عالية</option>
                    <option value="medium">متوسطة</option>
                    <option value="low">عادية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">التكرار</label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
                    className="w-full min-h-[40px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  >
                    <option value="daily">يومي</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="monthly">شهري</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresProof}
                  onChange={(e) => setRequiresProof(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>يتطلب إرفاق صورة إثبات عند الإنجاز</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[46px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors cursor-pointer"
              >
                {saving ? 'جاري الإضافة...' : 'إضافة وتفعيل المسؤولية'}
              </button>
            </form>

            {/* Recurring Templates */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">المسؤوليات المتكررة المفعلة</h4>
              <div className="space-y-2">
                {responsibilities.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 text-xs py-2 border-b last:border-0 border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</div>
                      <div className="text-slate-500">
                        {r.recurrence === 'daily' ? 'يومي' : r.recurrence === 'weekly' ? 'أسبوعي' : 'شهري'} · {r.dueTime}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleResponsibilityActive(uid, profile.id, r.id, !r.active)}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        r.active
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {r.active ? 'مفعل' : 'متوقف'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Daily Tasks Execution & Guardian Approval */}
        <div className={`${appMode === 'guardian' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-3`}>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-amber-500" />
            <span>مهام اليوم ({dayTasks.length})</span>
          </h3>

          {dayTasks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              لا توجد مهام مسجلة لهذا اليوم.
            </div>
          ) : (
            dayTasks.map((task) => (
              <div
                key={task.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mb-1">
                      الموعد: {task.dueTime} · الأولوية:{' '}
                      {task.priority === 'high' ? 'عالية' : task.priority === 'medium' ? 'متوسطة' : 'عادية'}
                      {task.completedAt && ` · نُفذت الساعة ${task.completedAt}`}
                    </div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{task.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.guardianApproved ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span>معتمد من ولي الأمر</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">بانتظار الاعتماد</span>
                    )}
                    {appMode === 'guardian' && (
                      <button
                        type="button"
                        onClick={() => deleteTaskItem(uid, profile.id, task.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {task.proofImageDataUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-xs">
                    <img
                      src={task.proofImageDataUrl}
                      alt={`إثبات ${task.title}`}
                      className="w-full h-36 object-cover"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'completed', label: 'مكتمل' },
                        { id: 'partial', label: 'جزئي' },
                        { id: 'pending', label: 'قيد التنفيذ' },
                        { id: 'missed', label: 'لم يتم' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          updateTaskProgress(uid, profile.id, task.id, {
                            status: st.id,
                            notes: task.notes,
                          })
                        }
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                          task.status === st.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                      <Camera className="w-4 h-4" />
                      <span>إرفاق صورة إثبات</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleProofUpload(task, e.target.files?.[0])}
                      />
                    </label>

                    {appMode === 'guardian' && (
                      <button
                        type="button"
                        onClick={() =>
                          approveTaskByGuardian(
                            uid,
                            profile.id,
                            task.id,
                            guardianName,
                            !task.guardianApproved,
                            task.status === 'pending' ? 'completed' : task.status,
                            task.notes
                          )
                        }
                        className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                          task.guardianApproved
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{task.guardianApproved ? 'إلغاء الاعتماد' : 'اعتماد ولي الأمر'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
