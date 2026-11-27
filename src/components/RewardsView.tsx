import React, { useState } from 'react';
import { Award, Flame, Gift, HeartHandshake, Plus, Star, Trophy } from 'lucide-react';
import {
  BADGE_CATALOG,
  type Achievement,
  type AppMode,
  type MonitoredProfile,
  type Reward,
} from '../types/behavior';
import { addReward, redeemReward } from '../lib/firestoreService';

export function RewardsView({
  uid,
  profile,
  appMode,
  rewards,
  achievements,
}: {
  uid: string;
  profile: MonitoredProfile;
  appMode: AppMode;
  rewards: Reward[];
  achievements: Achievement[];
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('نشاط ترفيهي');
  const [costPoints, setCostPoints] = useState(120);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const earnedMap = new Map(achievements.map((a) => [a.badgeKey, a]));

  const handleAddReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await addReward(uid, profile.id, { title, description, category, costPoints });
      setTitle('');
      setDescription('');
      setFeedback('تمت إضافة المكافأة التحفيزية بنجاح.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر إضافة المكافأة.');
    } finally {
      setSaving(false);
    }
  };

  const handleRedeem = async (reward: Reward) => {
    setFeedback(null);
    try {
      await redeemReward(uid, profile, reward);
      setFeedback(`مبارك! تم استبدال المكافأة: ${reward.title}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'تعذر استبدال المكافأة.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">النقاط والشارات والمكافآت</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          نظام تحفيزي إيجابي يعزز الاستمرارية والنجاح دون عقاب قاسٍ أو حرمان
        </p>
      </div>

      {/* Points, Stars, Streak Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-l from-amber-500/15 to-amber-500/5 border border-amber-500/25 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-300">رصيد النقاط الحالي</div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
              {profile.totalPoints}
            </div>
          </div>
          <Trophy className="w-9 h-9 text-amber-500" />
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-l from-emerald-500/15 to-emerald-500/5 border border-emerald-500/25 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-300">النجوم المكتسبة</div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
              {profile.totalStars}
            </div>
          </div>
          <Star className="w-9 h-9 text-emerald-500" />
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-l from-teal-500/15 to-teal-500/5 border border-teal-500/25 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-300">سلسلة أيام الالتزام</div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
              {profile.activeStreak} <span className="text-sm font-normal">أيام</span>
            </div>
          </div>
          <Flame className="w-9 h-9 text-teal-500" />
        </div>
      </section>

      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
        <HeartHandshake className="w-5 h-5 text-emerald-500 shrink-0" />
        <span>
          الميثاق التربوي: المكافآت وسيلة تشجيع وتقدير للجهد، ولا يجوز استخدام نقص النقاط للحرمان من الاحتياجات الأساسية أو الإهانة.
        </span>
      </div>

      {/* Badges Section */}
      <section className="space-y-3">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <span>الشارات والإنجازات</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BADGE_CATALOG.map((badge) => {
            const earned = earnedMap.has(badge.key);
            return (
              <div
                key={badge.key}
                className={`p-5 rounded-2xl border transition-colors ${
                  earned
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-400/40'
                    : 'bg-white dark:bg-[#0D192D] border-slate-200 dark:border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">{badge.titleAr}</h4>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      earned ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {earned ? 'تم الحصول عليها' : `+${badge.pointsBonus} نقطة`}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {badge.descriptionAr}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {/* Custom Rewards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {appMode === 'guardian' && (
          <form
            onSubmit={handleAddReward}
            className="lg:col-span-4 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-4 h-fit"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              <span>تخصيص مكافأة جديدة</span>
            </h3>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">اسم المكافأة</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: رحلة بحرية أو لعبة تعليمية"
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">التصنيف</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                >
                  <option value="نشاط ترفيهي">نشاط ترفيهي</option>
                  <option value="نزهة">نزهة</option>
                  <option value="وجبة مفضلة">اختيار وجبة مفضلة</option>
                  <option value="وقت إضافي">وقت إضافي لنشاط مناسب</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">النقاط المطلوبة</label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={costPoints}
                  onChange={(e) => setCostPoints(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">الوصف</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer"
            >
              {saving ? 'جاري الحفظ...' : 'إضافة المكافأة'}
            </button>
          </form>
        )}

        <div className={`${appMode === 'guardian' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-3`}>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-500" />
            <span>قائمة المكافآت المتاحة ({rewards.length})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rewards.map((rw) => {
              const canRedeem = !rw.redeemed && profile.totalPoints >= rw.costPoints;
              return (
                <div
                  key={rw.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {rw.category} · <span className="tabular-nums font-semibold">{rw.costPoints} نقطة</span>
                    </div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{rw.title}</h4>
                    {rw.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{rw.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!canRedeem}
                    onClick={() => handleRedeem(rw)}
                    className={`min-h-[42px] px-4 rounded-xl text-xs font-bold transition-colors ${
                      rw.redeemed
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-default'
                        : canRedeem
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {rw.redeemed
                      ? 'تم استبدالها'
                      : canRedeem
                        ? 'استبدال المكافأة الآن'
                        : `متبقي ${rw.costPoints - profile.totalPoints} نقطة`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
