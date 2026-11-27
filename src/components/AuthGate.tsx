import React, { useState } from 'react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { Lock } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { IslamicEmblem, IslamicGeometricHeaderBackdrop } from './IslamicDecor';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGmailSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          setError('المتصفح منع نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.');
        }
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(
          `النطاق (${host}) غير مضاف بعد في قائمة النطاقات المصرح بها (Authorized Domains) في إعدادات Firebase Authentication.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      } else {
        setError('تعذر تسجيل الدخول بحساب Gmail. يرجى المحاولة مجدداً.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#071120] text-slate-100 overflow-hidden"
    >
      <IslamicGeometricHeaderBackdrop />

      <div className="relative z-10 max-w-md w-full rounded-3xl border border-white/10 bg-[#0B172A]/92 backdrop-blur-xl p-7 sm:p-9 shadow-2xl text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <IslamicEmblem size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">BEHAVIOR INSIGHT</h1>
            <p className="text-xs sm:text-sm text-emerald-300 font-medium mt-0.5">
              نحو سلوك أفضل.. يوم بعد يوم
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">تسجيل الدخول عبر Gmail</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            سجّل الدخول بحساب Gmail الخاص بك للوصول إلى ملفاتك وسجلاتك المحفوظة بأمان.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs leading-relaxed text-right">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGmailSignIn}
          disabled={loading}
          className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-950/50 cursor-pointer"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#ffffff"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
            />
          </svg>
          <span>{loading ? 'جاري تسجيل الدخول...' : 'الدخول باستخدام Gmail'}</span>
        </button>

        <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>حسابات محمية ومفصولة تماماً عبر Firebase</span>
        </div>
      </div>
    </div>
  );
}
