import React, { useState } from 'react';

export const BANNER_IMAGE_PATH = '/src/assets/images/islamic_geometric_banner_1795768256788.jpg';
export const EMBLEM_IMAGE_PATH = '/src/assets/images/behavior_insight_emblem_1795768256707.jpg';

export function IslamicEmblem({ size = 36 }: { size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-xl bg-gradient-to-br from-emerald-600 to-slate-900 border border-amber-400/30 flex items-center justify-center shrink-0"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.6">
          <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={EMBLEM_IMAGE_PATH}
      alt="شعار BEHAVIOR INSIGHT"
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      style={{ width: size, height: size }}
      className="rounded-xl object-cover border border-amber-400/25 shrink-0"
    />
  );
}

export function IslamicGeometricHeaderBackdrop() {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return (
      <div className="absolute inset-0 bg-gradient-to-l from-[#0B162C] via-[#0E3140] to-[#0D5C4B] opacity-95" />
    );
  }
  return (
    <>
      <img
        src={BANNER_IMAGE_PATH}
        alt="خلفية هندسية إسلامية"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="absolute inset-0 w-full h-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-[#091529]/90 via-[#0B1E36]/75 to-[#0B3B36]/80" />
    </>
  );
}
