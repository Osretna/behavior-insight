import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { createMonitoredProfile } from '../lib/firestoreService';
import { IslamicEmblem } from './IslamicDecor';

export function ProfileSetupModal({
  uid,
  onCreated,
}: {
  uid: string;
  onCreated: (profileId: string) => void;
}) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(10);
  const [city, setCity] = useState('القاهرة');
  const [country, setCountry] = useState('Egypt');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const id = await createMonitoredProfile(uid, {
        name,
        age,
        city,
        country,
        dailyGoalMinutes,
      });
      onCreated(id);
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
          <IslamicEmblem size={44} />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">إنشاء الملف الشخصي الأول</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ابدأ بإدخال بيانات الشخص الذي ستتم متابعة سلوكه وإنجازاته يومياً
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">العمر</label>
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
          <UserPlus className="w-4 h-4" />
          <span>{loading ? 'جاري التهيئة...' : 'بدء رحلة المتابعة الآن'}</span>
        </button>
      </form>
    </div>
  );
}
