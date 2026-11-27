import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Compass, Globe2, Lock, MapPin, Moon, RefreshCw, Shield } from 'lucide-react';
import {
  PRAYERS_META,
  type MonitoredProfile,
  type PrayerKey,
  type PrayerRecord,
  type PrayerStatus,
  type PrayerTimesResponse,
} from '../types/behavior';
import { fetchPrayerTimes } from '../lib/apiClient';
import { updateProfileDetails, upsertPrayerStatus } from '../lib/firestoreService';
import {
  detectUserLocationSmart,
  KNOWN_LOCATIONS,
  resolveKnownLocation,
} from '../lib/locations';
import { computePrayerScore, getOffsetDateKey, getTodayDateKey } from '../lib/scoring';
import { ProgressRing, WeeklyBarChart } from './Charts';

export function PrayerView({
  uid,
  profile,
  prayerRecords,
}: {
  uid: string;
  profile: MonitoredProfile;
  prayerRecords: PrayerRecord[];
}) {
  const todayKey = getTodayDateKey();
  const [dateKey, setDateKey] = useState(todayKey);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesResponse | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<Record<PrayerKey, string>>({
    fajr: '',
    dhuhr: '',
    asr: '',
    maghrib: '',
    isha: '',
  });
  const [savingKey, setSavingKey] = useState<PrayerKey | null>(null);
  const [alertsMsg, setAlertsMsg] = useState<string | null>(null);
  const [locationStatusMsg, setLocationStatusMsg] = useState<string | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const currentRecord = prayerRecords.find((r) => r.dateKey === dateKey);
  const dayScore = computePrayerScore(currentRecord ?? null, 'unrated');

  const loadTimes = async (useGeo = false) => {
    setLoadingTimes(true);
    setTimesError(null);
    if (useGeo) setLocationStatusMsg(null);

    try {
      if (useGeo) {
        const detected = await detectUserLocationSmart();
        await updateProfileDetails(uid, profile.id, {
          latitude: detected.lat,
          longitude: detected.lng,
          city: detected.city,
          country: detected.country,
        });
        const data = await fetchPrayerTimes({
          lat: detected.lat,
          lng: detected.lng,
          city: detected.city,
          country: detected.country,
          method: detected.method,
        });
        setPrayerTimes(data);
        setLocationStatusMsg(
          detected.source === 'gps'
            ? `تم تحديد موقعك بدقة: ${detected.city} — ${detected.country}`
            : `تم تحديد موقعك تقريبياً عبر الشبكة: ${detected.city} — ${detected.country} (يمكنك تغيير المحافظة يدوياً إذا أردت)`
        );
      } else if (typeof profile.latitude === 'number' && typeof profile.longitude === 'number') {
        const data = await fetchPrayerTimes({
          lat: profile.latitude,
          lng: profile.longitude,
          city: profile.city,
          country: profile.country,
        });
        setPrayerTimes(data);
      } else {
        const known = resolveKnownLocation(profile.city, profile.country);
        const data = await fetchPrayerTimes({
          city: profile.city || 'القاهرة',
          country: profile.country || 'مصر',
          lat: known?.lat,
          lng: known?.lng,
          method: known?.method,
        });
        setPrayerTimes(data);
      }
    } catch (err) {
      setTimesError(err instanceof Error ? err.message : 'تعذر تحديث مواقيت الصلاة.');
    } finally {
      setLoadingTimes(false);
    }
  };

  const handleSelectKnownLocation = async (loc: (typeof KNOWN_LOCATIONS)[number]) => {
    setLoadingTimes(true);
    setTimesError(null);
    setLocationStatusMsg(null);
    try {
      await updateProfileDetails(uid, profile.id, {
        city: loc.cityAr,
        country: loc.countryAr,
        latitude: loc.lat,
        longitude: loc.lng,
      });
      const data = await fetchPrayerTimes({
        lat: loc.lat,
        lng: loc.lng,
        city: loc.cityEn,
        country: loc.countryEn,
        method: loc.method,
      });
      setPrayerTimes(data);
      setShowCityPicker(false);
      setLocationStatusMsg(`تم ضبط المواقيت لمدينة: ${loc.cityAr} — ${loc.countryAr}`);
    } catch (err) {
      setTimesError(err instanceof Error ? err.message : 'تعذر حفظ المدينة وتحديث المواقيت.');
    } finally {
      setLoadingTimes(false);
    }
  };

  const filteredLocations = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return KNOWN_LOCATIONS;
    return KNOWN_LOCATIONS.filter(
      (loc) =>
        loc.cityAr.toLowerCase().includes(q) ||
        loc.cityEn.toLowerCase().includes(q) ||
        loc.countryAr.toLowerCase().includes(q) ||
        loc.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }, [citySearch]);

  useEffect(() => {
    loadTimes(false);
  }, [profile.id, profile.city, profile.country, profile.latitude, profile.longitude]);

  useEffect(() => {
    if (currentRecord) {
      setNoteInput({
        fajr: currentRecord.prayers.fajr?.note || '',
        dhuhr: currentRecord.prayers.dhuhr?.note || '',
        asr: currentRecord.prayers.asr?.note || '',
        maghrib: currentRecord.prayers.maghrib?.note || '',
        isha: currentRecord.prayers.isha?.note || '',
      });
    } else {
      setNoteInput({ fajr: '', dhuhr: '', asr: '', maghrib: '', isha: '' });
    }
  }, [currentRecord, dateKey]);

  const handleToggleAlerts = async () => {
    const next = !profile.prayerAlertsEnabled;
    if (next && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    await updateProfileDetails(uid, profile.id, { prayerAlertsEnabled: next });
    setAlertsMsg(next ? 'تم تفعيل تنبيهات مواقيت الصلاة الاختيارية.' : 'تم إيقاف تنبيهات الصلاة.');
  };

  const handleSetStatus = async (key: PrayerKey, status: PrayerStatus) => {
    setSavingKey(key);
    try {
      await upsertPrayerStatus(uid, profile.id, dateKey, key, status, noteInput[key], currentRecord);
    } finally {
      setSavingKey(null);
    }
  };

  // Weekly & Monthly Prayer consistency comparison
  const stats = useMemo(() => {
    const calcPct = (startOffset: number, endOffset: number) => {
      const start = getOffsetDateKey(startOffset, todayKey);
      const end = getOffsetDateKey(endOffset, todayKey);
      const slice = prayerRecords.filter((r) => r.dateKey >= start && r.dateKey <= end);
      if (slice.length === 0) return 0;
      let totalPossible = 0;
      let performed = 0;
      for (const rec of slice) {
        for (const p of Object.values(rec.prayers)) {
          if (p.status !== 'unlogged') {
            totalPossible += 1;
            if (p.status === 'on_time' || p.status === 'late') performed += 1;
          }
        }
      }
      return totalPossible > 0 ? Math.round((performed / totalPossible) * 100) : 0;
    };
    return {
      thisWeekPct: calcPct(-6, 0),
      prevWeekPct: calcPct(-13, -7),
      thisMonthPct: calcPct(-29, 0),
    };
  }, [prayerRecords, todayKey]);

  const weeklyPrayerBars = useMemo(() => {
    const map = new Map(prayerRecords.map((r) => [r.dateKey, r]));
    const bars: { label: string; value: number | null; color: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dk = getOffsetDateKey(-i, todayKey);
      const rec = map.get(dk) ?? null;
      const sc = computePrayerScore(rec, 'unrated');
      const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(
        new Date(`${dk}T12:00:00`)
      );
      bars.push({
        label: dayName,
        value: sc,
        color: '#10B981',
      });
    }
    return bars;
  }, [prayerRecords, todayKey]);

  const statusButtons: { value: PrayerStatus; label: string }[] = [
    { value: 'on_time', label: 'تمت في وقتها' },
    { value: 'late', label: 'تمت متأخرة' },
    { value: 'missed', label: 'لم تتم' },
    { value: 'unlogged', label: 'غير مسجلة بعد' },
  ];

  const prayerTimeMap: Record<PrayerKey, string> = {
    fajr: prayerTimes?.timings.Fajr ?? '--:--',
    dhuhr: prayerTimes?.timings.Dhuhr ?? '--:--',
    asr: prayerTimes?.timings.Asr ?? '--:--',
    maghrib: prayerTimes?.timings.Maghrib ?? '--:--',
    isha: prayerTimes?.timings.Isha ?? '--:--',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            المحور الثالث: المحافظة على الصلاة
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            متابعة هادئة ومحترمة للصلوات الخمس اليومية ومواقيتها حسب موقعك الجغرافي
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
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-sm tabular-nums">
            {dayScore !== null ? `${dayScore.toFixed(1)} / 10` : 'غير مسجل'}
          </div>
        </div>
      </div>

      {/* Respect & Privacy Charter */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
        <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          سجل الصلاة خاص ومشفر لحساب الأسرة فقط؛ الهدف منه التشجيع والمتابعة التربوية اللطيفة دون إحراج أو إصدار أي أحكام دينية آلية.
        </p>
      </div>

      {/* Prayer Times & Location Widget */}
      <section className="p-6 rounded-2xl bg-gradient-to-l from-[#0B1C34] to-[#0D3A34] text-white border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-300 mb-1">
              <Moon className="w-4 h-4" />
              <span>مواقيت الصلاة الموثوقة</span>
              {prayerTimes?.hijri && (
                <span>
                  · {prayerTimes.hijri.day} {prayerTimes.hijri.month?.ar} {prayerTimes.hijri.year} هـ
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white">
              {profile.city || 'القاهرة'} — {profile.country || 'Egypt'}
            </h3>
            {prayerTimes?.methodName && (
              <p className="text-xs text-slate-300 mt-0.5">{prayerTimes.methodName}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadTimes(true)}
              disabled={loadingTimes}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <MapPin className="w-4 h-4 text-emerald-300" />
              <span>{loadingTimes ? 'جاري التحديد...' : 'تحديد موقعي التلقائي'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCityPicker((prev) => !prev)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Globe2 className="w-4 h-4 text-emerald-300" />
              <span>اختيار المدينة يدوياً</span>
            </button>
            <button
              type="button"
              onClick={() => loadTimes(false)}
              disabled={loadingTimes}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTimes ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={handleToggleAlerts}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                profile.prayerAlertsEnabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-white/10 text-white'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{profile.prayerAlertsEnabled ? 'التنبيهات مفعلة' : 'تفعيل التنبيهات'}</span>
            </button>
          </div>
        </div>

        {showCityPicker && (
          <div className="mb-4 p-4 rounded-2xl bg-slate-950/50 border border-white/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-200">
                اختر المحافظة أو المدينة لضبط مواقيت الصلاة بدقة:
              </span>
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="ابحث باسم المدينة أو المحافظة (مثال: القليوبية، القاهرة، الرياض)..."
                className="sm:w-72 min-h-[36px] px-3 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {filteredLocations.map((loc) => {
                const selected = profile.city === loc.cityAr;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    disabled={loadingTimes}
                    onClick={() => handleSelectKnownLocation(loc)}
                    className={`px-2.5 py-2 rounded-xl text-right text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    <div className="font-semibold truncate">{loc.cityAr}</div>
                    <div className="text-[10px] opacity-75 truncate">{loc.countryAr}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {locationStatusMsg && (
          <p className="text-xs text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-2 mb-3">
            {locationStatusMsg}
          </p>
        )}
        {timesError && (
          <div className="text-xs text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-xl px-3 py-2 mb-3 flex flex-wrap items-center justify-between gap-2">
            <span>{timesError}</span>
            <button
              type="button"
              onClick={() => setShowCityPicker(true)}
              className="underline font-bold text-white cursor-pointer"
            >
              اختر المدينة يدوياً
            </button>
          </div>
        )}
        {alertsMsg && <p className="text-xs text-emerald-200 mb-3">{alertsMsg}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'الفجر', time: prayerTimes?.timings.Fajr ?? '--:--' },
            { label: 'الشروق', time: prayerTimes?.timings.Sunrise ?? '--:--' },
            { label: 'الظهر', time: prayerTimes?.timings.Dhuhr ?? '--:--' },
            { label: 'العصر', time: prayerTimes?.timings.Asr ?? '--:--' },
            { label: 'المغرب', time: prayerTimes?.timings.Maghrib ?? '--:--' },
            { label: 'العشاء', time: prayerTimes?.timings.Isha ?? '--:--' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-xl bg-white/10 border border-white/10 text-center"
            >
              <div className="text-xs text-emerald-200">{item.label}</div>
              <div className="text-lg font-mono font-bold tabular-nums text-white mt-0.5">
                {item.time}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Five Daily Prayers Tracker */}
      <section className="space-y-3">
        <h3 className="font-bold text-base text-slate-900 dark:text-white">
          سجل الصلوات اليومي ({dateKey})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5">
          {PRAYERS_META.map((p) => {
            const entry = currentRecord?.prayers[p.key] ?? {
              status: 'unlogged' as PrayerStatus,
              loggedAt: '',
              note: '',
            };
            return (
              <div
                key={p.key}
                className="p-4 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{p.nameAr}</h4>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      الأذان: {prayerTimeMap[p.key]}
                    </span>
                  </div>
                  {entry.loggedAt && (
                    <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {entry.loggedAt}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {statusButtons.map((btn) => {
                    const active = entry.status === btn.value;
                    return (
                      <button
                        key={btn.value}
                        type="button"
                        disabled={savingKey === p.key}
                        onClick={() => handleSetStatus(p.key, btn.value)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? btn.value === 'on_time'
                              ? 'bg-emerald-600 text-white'
                              : btn.value === 'late'
                                ? 'bg-amber-600 text-white'
                                : btn.value === 'missed'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={noteInput[p.key]}
                  onChange={(e) => setNoteInput({ ...noteInput, [p.key]: e.target.value })}
                  onBlur={() => {
                    if (entry.status !== 'unlogged' && noteInput[p.key] !== entry.note) {
                      handleSetStatus(p.key, entry.status);
                    }
                  }}
                  placeholder="ملاحظة اختيارية..."
                  className="w-full min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Weekly & Monthly Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 space-y-5">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>نسبة المحافظة ومقارنة الفترات</span>
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col items-center gap-2">
              <ProgressRing percentage={stats.thisWeekPct} size={58} color="#10B981" />
              <span className="text-xs text-slate-600 dark:text-slate-300">الأسبوع الحالي</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col items-center gap-2">
              <ProgressRing percentage={stats.prevWeekPct} size={58} color="#64748B" />
              <span className="text-xs text-slate-600 dark:text-slate-300">الأسبوع السابق</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col items-center gap-2">
              <ProgressRing percentage={stats.thisMonthPct} size={58} color="#0D9488" />
              <span className="text-xs text-slate-600 dark:text-slate-300">آخر 30 يوماً</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {stats.thisWeekPct >= stats.prevWeekPct
              ? `التحسن مستمر: نسبة المحافظة هذا الأسبوع (${stats.thisWeekPct}%) أعلى أو مساوية للأسبوع السابق (${stats.prevWeekPct}%).`
              : `نسبة المحافظة هذا الأسبوع (${stats.thisWeekPct}%) مقابل (${stats.prevWeekPct}%) الأسبوع السابق — يمكن تعزيز التذكير اللطيف بأوقات الصلاة.`}
          </p>
        </div>

        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-500" />
            <span>المتابعة الأسبوعية للصلوات</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">متوسط التقييم اليومي من 10 خلال آخر 7 أيام</p>
          <WeeklyBarChart bars={weeklyPrayerBars} />
        </div>
      </section>
    </div>
  );
}
