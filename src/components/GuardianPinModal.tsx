import React, { useState } from 'react';
import { Lock, ShieldAlert, X } from 'lucide-react';
import { verifyGuardianPin } from '../lib/apiClient';

export function GuardianPinModal({
  isOpen,
  pinHash,
  onClose,
  onUnlocked,
}: {
  isOpen: boolean;
  pinHash: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin.trim())) {
      setError('أدخل رمز حماية مكوناً من 4 إلى 8 أرقام.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await verifyGuardianPin(pin.trim(), pinHash);
      if (ok) {
        setPin('');
        onUnlocked();
      } else {
        setError('رمز الحماية غير صحيح.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحقق من الرمز.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="max-w-sm w-full rounded-2xl bg-white dark:bg-[#0D1A2E] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              التحقق من وضع ولي الأمر
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          أدخل رمز الحماية (PIN) للوصول إلى صلاحيات ولي الأمر والإعدادات المتقدمة.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full px-4 py-3 text-center text-lg font-mono tracking-[0.4em] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {loading ? 'جاري التحقق...' : 'فتح الوضع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
