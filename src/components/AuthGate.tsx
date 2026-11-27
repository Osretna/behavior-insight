import React, { useEffect, useMemo, useRef, useState } from 'react';
import { signInWithPopup, type User } from 'firebase/auth';
import { AlertTriangle, ExternalLink, Lock } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { IslamicGeometricHeaderBackdrop } from './IslamicDecor';
import { PWAInstallButton } from './PWAInstallButton';

export function AuthGate({
  initialError = null,
  onSignedIn,
}: {
  initialError?: string | null;
  onSignedIn?: (user: User) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const signingInRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem('bi_auth_redirect_pending');
      sessionStorage.removeItem('bi_redirect_failed');
    } catch {
      // ignore
    }
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const isInIframe = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const isInAppBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /(FBAN|FBAV|Instagram|WhatsApp|Telegram|Line|MicroMessenger|Snapchat|TikTok|wv\))/i.test(
      navigator.userAgent
    );
  }, []);

  const handleGmailSignIn = async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setError(null);
    setErrorCode(null);
    setPopupBlocked(false);

    // Trigger popup immediately inside the click gesture before any async awaits
    const popupPromise = signInWithPopup(auth, googleProvider);
    setLoading(true);

    try {
      const credential = await popupPromise;
      if (credential?.user) {
        onSignedIn?.(credential.user);
      }
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      setErrorCode(code || null);

      if (code === 'auth/popup-blocked') {
        setPopupBlocked(true);
        setError(
          'المتصفح منع النافذة المنبثقة لتسجيل الدخول. اسمح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع من شريط العنوان أعلى المتصفح ثم اضغط الزر مرة أخرى.'
        );
      } else if (code === 'auth/cancelled-popup-request') {
        setError('تم فتح طلب تسجيل دخول سابق. يرجى إغلاق أي نافذة تسجيل دخول معلّقة والمحاولة مرة أخرى.');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(
          `النطاق (${host}) غير مضاف بعد في قائمة النطاقات المصرح بها (Authorized Domains) في إعدادات Firebase Authentication.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setError('تم إغلاق نافذة تسجيل الدخول قبل إتمام اختيار الحساب.');
      } else if (code === 'auth/network-request-failed') {
        setError('تعذر الاتصال بخدمة المصادقة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.');
      } else {
        setError('تعذر تسجيل الدخول بحساب Gmail. يرجى المحاولة مجدداً.');
      }
    } finally {
      signingInRef.current = false;
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
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-emerald-950/60 border border-amber-400/25">
            <img
              src="/pwa-192x192.png"
              alt="BEHAVIOR INSIGHT"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
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

        {isInAppBrowser && (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs leading-relaxed text-right flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <span>
              أنت تفتح التطبيق من داخل متصفح تطبيق آخر. إذا تعذر تسجيل الدخول، افتح الرابط في
              <strong> Chrome </strong>
              أو
              <strong> Safari </strong>
              مباشرة.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs leading-relaxed text-right space-y-2">
            <p>{error}</p>
            {errorCode && (
              <p className="text-[11px] font-mono text-rose-300/80" dir="ltr">
                {errorCode}
              </p>
            )}
            {(popupBlocked || isInIframe) && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح الصفحة في نافذة مستقلة لتسجيل الدخول</span>
              </a>
            )}
          </div>
        )}

        <div className="space-y-3">
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

          <PWAInstallButton className="bg-white/5 hover:bg-white/10 border-white/15 text-emerald-300" />
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>حسابات محمية ومفصولة تماماً عبر Firebase</span>
        </div>
      </div>
    </div>
  );
}
