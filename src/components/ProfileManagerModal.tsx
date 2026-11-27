import React, { useState } from 'react';
import { Check, ListPlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import type { MonitoredProfile } from '../types/behavior';
import { createMonitoredProfile, deleteMonitoredProfile } from '../lib/firestoreService';

const AVATAR_COLORS = ['#0D9488', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777'];

export function ProfileManagerModal({
  isOpen,
  uid,
  profiles,
  activeProfileId,
  onSelectProfile,
  onClose,
}: {
  isOpen: boolean;
  uid: string;
  profiles: MonitoredProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onClose: () => void;
}) {
  const [addMode, setAddMode] = useState<'single' | 'batch'>('single');
  const [name, setName] = useState('');
  const [age, setAge] = useState(10);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [batchText, setBatchText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      if (addMode === 'single') {
        if (!name.trim()) {
          setFeedback('يرجى كتابة الاسم أولاً.');
          setSaving(false);
          return;
        }
        const newId = await createMonitoredProfile(uid, {
          name: name.trim(),
          age,
          dailyGoalMinutes,
          avatarColor: selectedColor,
        });
        setName('');
        onSelectProfile(newId);
        setFeedback('تمت إضافة الاسم وتفعيله للتقييم.');
      } else {
        const namesList = batchText
          .split(/[\n,،]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (namesList.length === 0) {
          setFeedback('اكتب اسماً واحداً على الأقل (كل اسم في سطر).');
          setSaving(false);
          return;
        }
        let firstCreated = '';
        for (let i = 0; i < namesList.length; i++) {
          const id = await createMonitoredProfile(uid, {
            name: namesList[i],
            age,
            dailyGoalMinutes,
            avatarColor: AVATAR_COLORS[(profiles.length + i) % AVATAR_COLORS.length],
          });
          if (!firstCreated) firstCreated = id;
        }
        setBatchText('');
        if (firstCreated) onSelectProfile(firstCreated);
        setFeedback(`تمت إضافة ${namesList.length} أسماء إلى القائمة بنجاح.`);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذرت الإضافة.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      await deleteMonitoredProfile(uid, profileId);
      setConfirmDeleteId(null);
      setFeedback('تم حذف الاسم من القائمة.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر الحذف.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-700 p-6 sm:p-7 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">قائمة الأسماء وإدارة الملفات</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أضف أسماء جديدة واختر الشخص الذي تريد متابعته وتقييمه الآن
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Names List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              الأسماء المسجلة ({profiles.length})
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">اضغط على أي اسم لاختياره</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-0.5">
            {profiles.map((p) => {
              const active = p.id === activeProfileId;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-colors ${
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProfile(p.id);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-right cursor-pointer"
                  >
                    <span
                      style={{ backgroundColor: p.avatarColor || '#0D9488' }}
                      className="w-9 h-9 rounded-xl text-white font-bold text-sm flex items-center justify-center shrink-0"
                    >
                      {p.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {p.age} سنة · {p.totalPoints} نقطة
                      </div>
                    </div>
                  </button>

                  {profiles.length > 1 && (
                    confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDelete(p.id)}
                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          تأكيد
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
                        title="حذف الاسم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add New Single or Batch Names */}
        <form onSubmit={handleAdd} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">إضافة أسماء جديدة</h3>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  addMode === 'single'
                    ? 'bg-white dark:bg-[#0D192D] text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                اسم واحد
              </button>
              <button
                type="button"
                onClick={() => setAddMode('batch')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  addMode === 'batch'
                    ? 'bg-white dark:bg-[#0D192D] text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                قائمة أسماء متعددة
              </button>
            </div>
          </div>

          {addMode === 'single' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">الاسم</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: سارة / عبد الرحمن"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">العمر</label>
                <input
                  type="number"
                  min={3}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums text-slate-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  أدخل قائمة الأسماء (كل اسم في سطر منفصل أو مفصولة بفاصلة)
                </label>
                <textarea
                  rows={3}
                  required
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={'عمر\nمريم\nيوسف\nخديجة'}
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">العمر الافتراضي</label>
                  <input
                    type="number"
                    min={3}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">هدف المذاكرة (دقائق)</label>
                  <input
                    type="number"
                    min={10}
                    max={480}
                    value={dailyGoalMinutes}
                    onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {addMode === 'single' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">لون التمييز:</span>
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      selectedColor === c ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : ''
                    }`}
                    aria-label={c}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">هدف المذاكرة:</span>
                <input
                  type="number"
                  min={10}
                  max={480}
                  value={dailyGoalMinutes}
                  onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
                  className="w-20 min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs tabular-nums"
                />
                <span className="text-xs text-slate-400">د</span>
              </div>
            </div>
          )}

          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300">
              {feedback}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              {addMode === 'single' ? <UserPlus className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
              <span>{saving ? 'جاري الحفظ...' : addMode === 'single' ? 'إضافة الاسم للقائمة' : 'إضافة جميع الأسماء'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
