import React, { useState } from 'react';
import { ListPlus, UserPlus, Users } from 'lucide-react';
import { createMonitoredProfile } from '../lib/firestoreService';

const AVATAR_COLORS = ['#0D9488', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777'];

export function ProfileSetupModal({
  uid,
  onCreated,
}: {
  uid: string;
  onCreated: (profileId: string) => void;
}) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [name, setName] = useState('');
  const [batchNames, setBatchNames] = useState('');
  const [age, setAge] = useState(10);
  const [city, setCity] = useState('القاهرة');
  const [country, setCountry] = useState('Egypt');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'single') {
        if (!name.trim()) {
          setError('يرجى كتابة الاسم الشخصي.');
          setLoading(false);
          return;
        }
        const id = await createMonitoredProfile(uid, {
          name: name.trim(),
          age,
          city,
          country,
          dailyGoalMinutes,
          avatarColor: AVATAR_COLORS[0],
        });
        onCreated(id);
      } else {
        const namesList = batchNames
          .split(/[\n,،]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (namesList.length === 0) {
          setError('يرجى إدخال اسم واحد على الأقل (كل اسم في سطر).');
          setLoading(false);
          return;
        }
        let firstId = '';
        for (let i = 0; i < namesList.length; i++) {
          const id = await createMonitoredProfile(uid, {
            name: namesList[i],
            age,
            city,
            country,
            dailyGoalMinutes,
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          });
          if (!firstId) firstId = id;
        }
        if (firstId) onCreated(firstId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الملف الشخصي.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#071120]">
      <form
        onSubmit={handleSubmit}
        className="max-w-lg w-full rounded-3xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 p-7 sm:p-9 shadow-xl space-y-5"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-amber-400/25 shrink-0">
            <img
              src="/pwa-192x192.png"
              alt="BEHAVIOR INSIGHT"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">إنشاء قائمة الأسماء والمتابعة</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              أضف اسماً واحداً أو قائمة أسماء كاملة لاختيار من تريد تقييمه يومياً
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`min-h-[40px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'single'
                ? 'bg-white dark:bg-[#0D192D] text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة اسم واحد</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`min-h-[40px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'batch'
                ? 'bg-white dark:bg-[#0D192D] text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إضافة قائمة أسماء</span>
          </button>
        </div>

        <div className="space-y-3.5">
          {mode === 'single' ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                الاسم الشخصي
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: عمر / مريم"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                قائمة الأسماء (اكتب كل اسم في سطر منفصل)
              </label>
              <textarea
                rows={4}
                required
                value={batchNames}
                onChange={(e) => setBatchNames(e.target.value)}
                placeholder={'عمر\nمريم\nيوسف'}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">العمر الافتراضي</label>
              <input
                type="number"
                min={3}
                max={99}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                هدف المذاكرة (دقائق/يوم)
              </label>
              <input
                type="number"
                min={10}
                max={480}
                value={dailyGoalMinutes}
                onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                المدينة (لمواقيت الصلاة)
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">الدولة</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {mode === 'single' ? <UserPlus className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
          <span>{loading ? 'جاري الإضافة والتهيئة...' : mode === 'single' ? 'إضافة وبدء التقييم' : 'إضافة القائمة والبدء'}</span>
        </button>
      </form>
    </div>
  );
}
