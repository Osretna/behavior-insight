import React, { useEffect, useState } from 'react';
import { Download, History, Lock, Plus, Save, Settings, Shield, SunMoon, Upload, UserPlus } from 'lucide-react';
import {
  AXIS_META,
  type AuditLog,
  type AxisKey,
  type AxisWeights,
  type BehaviorCategory,
  type MonitoredProfile,
  type UserAccount,
} from '../types/behavior';
import {
  createMonitoredProfile,
  exportProfileBackup,
  restoreProfileBackup,
  updateBehaviorCategory,
  updateProfileDetails,
  updateProfileWeights,
  updateUserPin,
  updateUserPreferences,
} from '../lib/firestoreService';
import { hashGuardianPin } from '../lib/apiClient';
import { resolveKnownLocation } from '../lib/locations';

export function SettingsView({
  uid,
  userAccount,
  profile,
  profiles,
  categories,
  auditLogs,
  onSelectProfile,
  onThemeChange,
}: {
  uid: string;
  userAccount: UserAccount;
  profile: MonitoredProfile;
  profiles: MonitoredProfile[];
  categories: BehaviorCategory[];
  auditLogs: AuditLog[];
  onSelectProfile: (id: string) => void;
  onThemeChange: (theme: 'dark' | 'light') => void;
}) {
  const [weights, setWeights] = useState<AxisWeights>(profile.weights);
  const [profileName, setProfileName] = useState(profile.name);
  const [profileAge, setProfileAge] = useState(profile.age);
  const [city, setCity] = useState(profile.city || 'القاهرة');
  const [country, setCountry] = useState(profile.country || 'Egypt');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(profile.dailyGoalMinutes);

  // New Profile form
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState(10);

  // PIN management
  const [newPin, setNewPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Criteria editor
  const [selectedAxis, setSelectedAxis] = useState<AxisKey>('obedience');
  const activeCategory = categories.find((c) => c.key === selectedAxis);
  const [newCriterion, setNewCriterion] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeights(profile.weights);
    setProfileName(profile.name);
    setProfileAge(profile.age);
    setCity(profile.city || 'القاهرة');
    setCountry(profile.country || 'Egypt');
    setDailyGoalMinutes(profile.dailyGoalMinutes);
  }, [profile]);

  const weightSum = weights.obedience + weights.study + weights.prayer + weights.responsibilities;

  const handleSaveProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const known = resolveKnownLocation(city, country);
      const cityChanged = city.trim() !== (profile.city || '').trim();
      await updateProfileDetails(uid, profile.id, {
        name: profileName,
        age: profileAge,
        city,
        country,
        dailyGoalMinutes,
        ...(cityChanged && known ? { latitude: known.lat, longitude: known.lng } : {}),
      });
      setMessage('تم تحديث بيانات الملف الشخصي وموقع مواقيت الصلاة.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التغييرات.');
    }
  };

  const handleSaveWeights = async () => {
    setMessage(null);
    setError(null);
    if (weightSum !== 100) {
      setError(`مجموع الأوزان الحالي هو ${weightSum}% ويجب أن يساوي 100% بالضبط.`);
      return;
    }
    try {
      await updateProfileWeights(uid, profile.id, weights, userAccount.displayName);
      setMessage('تم حفظ أوزان المحاور الأربعة وتوثيقها.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الأوزان.');
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setMessage(null);
    setError(null);
    try {
      const id = await createMonitoredProfile(uid, {
        name: newName,
        age: newAge,
        city,
        country,
      });
      setNewName('');
      onSelectProfile(id);
      setMessage('تم إنشاء الملف الشخصي الجديد بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الملف.');
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(newPin.trim())) {
      setError('يجب أن يكون رمز الحماية PIN من 4 إلى 8 أرقام.');
      return;
    }
    setPinLoading(true);
    setMessage(null);
    setError(null);
    try {
      const hashed = await hashGuardianPin(newPin.trim());
      await updateUserPin(uid, true, hashed);
      setNewPin('');
      setMessage('تم تفعيل وتشفير رمز الحماية PIN لوضع ولي الأمر.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ رمز الحماية.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleDisablePin = async () => {
    setPinLoading(true);
    try {
      await updateUserPin(uid, false, '');
      setMessage('تم إيقاف قفل رمز الحماية PIN.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleAddCriterion = async () => {
    if (!activeCategory || !newCriterion.trim()) return;
    const nextList = [...activeCategory.subCriteria, newCriterion.trim()];
    await updateBehaviorCategory(uid, profile.id, activeCategory.id, {
      title: activeCategory.title,
      description: activeCategory.description,
      weight: weights[selectedAxis],
      subCriteria: nextList,
    });
    setNewCriterion('');
    setMessage('تمت إضافة المعيار الفرعي بنجاح.');
  };

  const handleExportBackup = async () => {
    const json = await exportProfileBackup(uid, profile.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `behavior-insight-backup-${profile.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const count = await restoreProfileBackup(uid, profile.id, text);
      setMessage(`تمت استعادة ${count} سجلاً من النسخة الاحتياطية بنجاح.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استعادة النسخة الاحتياطية.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">الإعدادات والأمان وإدارة الملفات</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          تخصيص الأوزان والمعايير، حماية وضع ولي الأمر برمز PIN، إدارة الملفات الشخصية، والنسخ الاحتياطي
        </p>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Settings */}
        <form
          onSubmit={handleSaveProfileInfo}
          className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-500" />
            <span>بيانات الملف الحالي ({profile.name})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الاسم</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">العمر</label>
              <input
                type="number"
                min={3}
                max={99}
                value={profileAge}
                onChange={(e) => setProfileAge(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">المدينة (لمواقيت الصلاة)</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الدولة</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
              هدف المذاكرة اليومي (بالدقائق)
            </label>
            <input
              type="number"
              min={10}
              max={480}
              value={dailyGoalMinutes}
              onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums"
            />
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ بيانات الملف</span>
          </button>
        </form>

        {/* Weights Configuration */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">أوزان التقييم للمحاور الأربعة</h3>
            <span
              className={`text-sm font-mono font-bold tabular-nums ${
                weightSum === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              المجموع: {weightSum}%
            </span>
          </div>

          <div className="space-y-3">
            {(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((key) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-700 dark:text-slate-200">{AXIS_META[key].titleAr}</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {weights[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[key]}
                  onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveWeights}
            className="min-h-[44px] px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold cursor-pointer"
          >
            اعتماد الأوزان الجديدة
          </button>
        </div>

        {/* Multi-profile Switcher & Creator */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-sky-500" />
            <span>الملفات الشخصية ({profiles.length})</span>
          </h3>

          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProfile(p.id)}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  p.id === profile.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {p.name} ({p.age} سنة)
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateProfile} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم الشخص الجديد..."
              className="flex-1 min-w-[160px] min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
            <input
              type="number"
              min={3}
              max={99}
              value={newAge}
              onChange={(e) => setNewAge(Number(e.target.value))}
              className="w-20 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums"
            />
            <button
              type="submit"
              className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة ملف</span>
            </button>
          </form>
        </div>

        {/* Guardian PIN Security & Theme */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-5">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <span>حماية وضع ولي الأمر (PIN) والمظهر</span>
          </h3>

          <form onSubmit={handleSetPin} className="flex flex-wrap gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="رمز PIN جديد (4-8 أرقام)"
              className="flex-1 min-w-[180px] min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
            />
            <button
              type="submit"
              disabled={pinLoading}
              className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
            >
              {userAccount.pinEnabled ? 'تحديث الرمز' : 'تفعيل القفل'}
            </button>
            {userAccount.pinEnabled && (
              <button
                type="button"
                onClick={handleDisablePin}
                className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                إلغاء القفل
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <SunMoon className="w-4 h-4 text-emerald-500" />
              <span>مظهر التطبيق والنسخ الاحتياطي</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const next = userAccount.theme === 'dark' ? 'light' : 'dark';
                  onThemeChange(next);
                  await updateUserPreferences(uid, { theme: next }, userAccount);
                }}
                className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                تبديل الوضع ({userAccount.theme === 'dark' ? 'الداكن' : 'الفاتح'})
              </button>

              <button
                type="button"
                onClick={handleExportBackup}
                className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>نسخة احتياطية JSON</span>
              </button>

              <label className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>استرجاع بيانات</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => handleRestoreBackup(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Sub-Criteria Manager */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>إدارة المعايير الفرعية للمحاور</span>
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {(['obedience', 'study', 'prayer', 'responsibilities'] as AxisKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedAxis(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedAxis === k
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {AXIS_META[k].titleAr}
              </button>
            ))}
          </div>

          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 max-h-44 overflow-y-auto">
            {(activeCategory?.subCriteria || AXIS_META[selectedAxis].defaultCriteria).map((c, idx) => (
              <li key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                {idx + 1}. {c}
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="إضافة معيار فرعي جديد..."
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
            />
            <button
              type="button"
              onClick={handleAddCriterion}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              إضافة
            </button>
          </div>
        </div>

        {/* Immutable Audit Log Viewer */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-amber-500" />
            <span>سجل التعديلات والتدقيق الأمني ({auditLogs.length})</span>
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              لا توجد تعديلات يدوية مسجلة بعد. أي تعديل على الدرجات أو الأوزان يُسجل هنا تلقائياً ولا يمكن حذفه.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs space-y-0.5"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {log.action} · بواسطة {log.actorName}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">{log.reason}</div>
                  <div className="text-slate-400">{log.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
