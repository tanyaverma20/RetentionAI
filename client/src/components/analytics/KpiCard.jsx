import React from 'react';

const COLOR_STYLES = {
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600',
    blob: 'bg-emerald-100/50',
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600',
    blob: 'bg-amber-100/50',
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600',
    blob: 'bg-rose-100/50',
  },
  violet: {
    iconBg: 'bg-violet-50 text-violet-600',
    blob: 'bg-violet-100/50',
  },
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-600',
    blob: 'bg-indigo-100/50',
  },
};

export default function KpiCard({ title, value, unit = '', trend, isPlaceholder = false, icon, color = 'indigo', label }) {
  const style = COLOR_STYLES[color] || COLOR_STYLES.indigo;

  return (
    <div className="relative p-6 bg-white border border-slate-100 rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 group overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 ${style.blob} pointer-events-none rounded-bl-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity`} />

      <div className="relative flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-2xl ${style.iconBg} flex items-center justify-center`}>
          {icon}
        </div>

        {isPlaceholder ? (
          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 rounded-full">
            Future ML
          </span>
        ) : trend ? (
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 ${
              trend === 'up'
                ? 'text-emerald-600 bg-emerald-50 border border-emerald-100'
                : 'text-indigo-600 bg-indigo-50 border border-indigo-100'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'} Benchmark
          </span>
        ) : null}
      </div>

      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          {title}
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value ?? '0'}
          </span>
          {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
        </div>
        {label && <p className="text-[11px] text-slate-400 mt-1.5">{label}</p>}
      </div>
    </div>
  );
}
