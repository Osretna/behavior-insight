import React, { useState } from 'react';
import type { AxisKey, DailyAssessment } from '../types/behavior';
import { getOffsetDateKey } from '../lib/scoring';

export function ProgressRing({
  percentage,
  size = 64,
  strokeWidth = 6,
  color = '#10B981',
  label,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}

export function AxisRadarChart({
  scores,
}: {
  scores: Record<AxisKey, number | null>;
}) {
  const cx = 140;
  const cy = 125;
  const maxR = 82;
  const axes: { key: AxisKey; label: string; angle: number }[] = [
    { key: 'obedience', label: 'سماع الكلام', angle: -Math.PI / 2 },
    { key: 'study', label: 'المذاكرة', angle: 0 },
    { key: 'prayer', label: 'الصلاة', angle: Math.PI / 2 },
    { key: 'responsibilities', label: 'الواجبات', angle: Math.PI },
  ];

  const getPoint = (angle: number, value: number) => {
    const ratio = Math.min(10, Math.max(0, value)) / 10;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
    };
  };

  const rings = [2.5, 5, 7.5, 10];
  const polygonPoints = axes
    .map((a) => {
      const p = getPoint(a.angle, scores[a.key] ?? 0);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="w-full flex flex-col items-center">
      <svg viewBox="0 0 280 250" className="w-full max-w-[290px] h-auto overflow-visible">
        {rings.map((ring) => {
          const pts = axes
            .map((a) => {
              const p = getPoint(a.angle, ring);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-200 dark:text-slate-800"
            />
          );
        })}
        {axes.map((a) => {
          const end = getPoint(a.angle, 10);
          return (
            <line
              key={a.key}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-200 dark:text-slate-800"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(16, 185, 129, 0.22)"
          stroke="#10B981"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {axes.map((a) => {
          const val = scores[a.key];
          const p = getPoint(a.angle, val ?? 0);
          const labelPos = getPoint(a.angle, 12.2);
          return (
            <g key={a.key}>
              {val !== null && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill="#10B981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-700 dark:fill-slate-300 text-[11px] font-semibold"
              >
                {a.label} ({val !== null ? val.toFixed(1) : '—'})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ScoreLineChart({
  data,
}: {
  data: { dateKey: string; label: string; score: number | null }[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const w = 520;
  const h = 190;
  const padX = 34;
  const padY = 22;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const validPoints = data
    .map((d, idx) => ({ ...d, idx }))
    .filter((d) => d.score !== null);

  const getX = (idx: number) =>
    data.length <= 1 ? padX + innerW / 2 : padX + (idx / (data.length - 1)) * innerW;
  const getY = (score: number) => padY + innerH - (score / 10) * innerH;

  const pathD =
    validPoints.length > 0
      ? validPoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.idx).toFixed(1)} ${getY(p.score!).toFixed(1)}`)
          .join(' ')
      : '';

  const areaD =
    validPoints.length > 1
      ? `${pathD} L ${getX(validPoints[validPoints.length - 1].idx).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${getX(validPoints[0].idx).toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
      : '';

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="w-full relative">
      {hovered && (
        <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 tabular-nums px-1">
          <span>التاريخ: {hovered.dateKey}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            الدرجة: {hovered.score !== null ? `${hovered.score.toFixed(1)} / 10` : 'غير مسجل'}
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48 overflow-visible">
        <defs>
          <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[2, 4, 6, 8, 10].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padX}
                y1={y}
                x2={w - padX}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-slate-200 dark:text-slate-800"
              />
              <text
                x={padX - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaD && <path d={areaD} fill="url(#scoreAreaGrad)" />}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {data.map((d, idx) => {
          const x = getX(idx);
          const showLabel = data.length <= 10 || idx % Math.ceil(data.length / 7) === 0 || idx === data.length - 1;
          return (
            <g
              key={d.dateKey}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect x={x - 12} y={padY} width={24} height={innerH} fill="transparent" />
              {d.score !== null && (
                <circle
                  cx={x}
                  cy={getY(d.score)}
                  r={hoveredIdx === idx ? 5.5 : 3.5}
                  fill={hoveredIdx === idx ? '#C8A24A' : '#10B981'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
              {showLabel && (
                <text
                  x={x}
                  y={h - 4}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] tabular-nums"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function WeeklyBarChart({
  bars,
}: {
  bars: { label: string; value: number | null; color?: string }[];
}) {
  return (
    <div className="w-full h-44 flex items-end justify-between gap-2 pt-4 pb-1">
      {bars.map((bar, idx) => {
        const val = bar.value ?? 0;
        const pct = Math.min(100, Math.max(0, (val / 10) * 100));
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {bar.value !== null ? bar.value.toFixed(1) : '—'}
            </span>
            <div className="w-full max-w-[34px] h-28 rounded-lg bg-slate-100 dark:bg-slate-800/70 flex items-end overflow-hidden">
              <div
                style={{
                  height: `${bar.value !== null ? Math.max(8, pct) : 0}%`,
                  backgroundColor: bar.color || '#0D9488',
                }}
                className="w-full rounded-t-md transition-all duration-500"
              />
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-full">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarHeatmap({
  assessments,
  endDateKey,
  days = 35,
}: {
  assessments: DailyAssessment[];
  endDateKey: string;
  days?: number;
}) {
  const [selectedDay, setSelectedDay] = useState<{ dateKey: string; score: number | null } | null>(null);
  const map = new Map(assessments.map((a) => [a.dateKey, a.scores.total]));

  const cells: { dateKey: string; score: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dk = getOffsetDateKey(-i, endDateKey);
    cells.push({ dateKey: dk, score: map.get(dk) ?? null });
  }

  const getCellStyle = (score: number | null) => {
    if (score === null) return 'bg-slate-100 dark:bg-slate-800/80 text-slate-400';
    if (score >= 8.5) return 'bg-emerald-600 text-white';
    if (score >= 7) return 'bg-teal-500/80 text-white';
    if (score >= 5) return 'bg-amber-500/80 text-white';
    return 'bg-rose-500/80 text-white';
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => (
          <button
            key={cell.dateKey}
            type="button"
            onClick={() => setSelectedDay(cell)}
            title={`${cell.dateKey}: ${cell.score !== null ? `${cell.score}/10` : 'غير مسجل'}`}
            className={`h-8 rounded-md text-[11px] font-mono tabular-nums flex items-center justify-center transition-transform hover:scale-105 ${getCellStyle(cell.score)}`}
          >
            {cell.dateKey.slice(8)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {selectedDay
            ? `${selectedDay.dateKey}: ${selectedDay.score !== null ? `${selectedDay.score.toFixed(1)} / 10` : 'لم يُسجل بعد'}`
            : `خريطة الالتزام لآخر ${days} يوماً`}
        </span>
        <div className="flex items-center gap-1.5">
          <span>أقل</span>
          <span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-800 inline-block" />
          <span className="w-3 h-3 rounded-sm bg-amber-500/80 inline-block" />
          <span className="w-3 h-3 rounded-sm bg-teal-500/80 inline-block" />
          <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />
          <span>أعلى</span>
        </div>
      </div>
    </div>
  );
}
