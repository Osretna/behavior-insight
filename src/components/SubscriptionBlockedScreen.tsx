import React, { useRef } from 'react';
import { LogOut, MessageCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { IslamicGeometricHeaderBackdrop } from './IslamicDecor';
import { buildWhatsAppSupportUrl, type AccessEvaluationResult } from '../lib/subscription';

export function SubscriptionBlockedScreen({
  userEmail,
  displayName,
  access,
  whatsappNumber,
  currency,
  onSignOut,
  onTriggerAdmin,
}: {
  userEmail: string;
  displayName: string;
  access: AccessEvaluationResult;
  whatsappNumber: string;
  currency: string;
  onSignOut: () => void;
  onTriggerAdmin: () => void;
}) {
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const handleLogoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current > 1500) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapRef.current = now;
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onTriggerAdmin();
    }
  };

  const statusReasonText =
    access.reason === 'suspended'
      ? 'تم إيقاف الحساب مؤقتاً من قِبل الإدارة.'
      : access.reason === 'expired'
        ? `انتهت فترة الاشتراك المحددة (${access.validUntil}).`
        : `تبدأ فترة التشغيل المحددة لهذا الحساب في (${access.validFrom}).`;

  const waUrl = buildWhatsAppSupportUrl({
    whatsappNumber,
    userEmail,
    displayName,
    price: access.effectivePrice,
    currency,
    reason: statusReasonText,
  });

  return (
    <div
      dir="rtl"
      className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 bg-[#071120] text-slate-100 overflow-hidden"
    >
      <IslamicGeometricHeaderBackdrop />

      <div className="relative z-10 max-w-md w-full rounded-3xl border border-white/10 bg-[#0B172A]/95 backdrop-blur-xl p-7 sm:p-9 shadow-2xl text-center space-y-6">
        <div className="flex flex-col items-center gap-3 select-none" onClick={handleLogoTap}>
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

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">يلزم تجديد أو تفعيل الاشتراك</h2>
          <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">{statusReasonText}</p>
          <p className="text-xs text-slate-300 leading-relaxed">
            يرجى التحدث معنا عبر الواتساب لإتمام دفع الاشتراك الشهري وإعادة تشغيل التطبيق على حسابك فوراً.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900/70 border border-white/10 p-4 text-xs space-y-2 text-right">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">حساب Gmail:</span>
            <span className="text-white font-mono truncate max-w-[210px]" dir="ltr">
              {userEmail}
            </span>
          </div>
          {access.effectivePrice > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
              <span className="text-slate-400">قيمة الاشتراك الشهري:</span>
              <span className="text-emerald-300 font-bold text-sm">
                {access.effectivePrice} {currency}
              </span>
            </div>
          )}
        </div>

        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-colors shadow-lg shadow-emerald-950/50"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
            <span>التحدث عبر الواتساب لدفع الاشتراك والتفعيل</span>
          </a>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            يرجى التواصل مع مسؤول التطبيق لإضافة رقم الواتساب وتفعيل اشتراكك.
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-300/90">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>سيعود التطبيق للعمل تلقائياً فور قيام الإدارة بتفعيل حسابك.</span>
        </div>

        <div className="pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تبديل حساب Gmail</span>
          </button>
        </div>
      </div>
    </div>
  );
}
