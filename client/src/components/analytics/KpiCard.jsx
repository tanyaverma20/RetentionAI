import React from 'react';

export default function KpiCard({ title, value, unit = '', trend, isPlaceholder = false, icon, color = 'indigo', label }) {
  const getColorStyles = (c) => {
    switch (c) {
      case 'emerald':
        return {
          iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          gradient: 'from-emerald-500/10 to-transparent',
          border: 'hover:border-emerald-500/40',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          gradient: 'from-amber-500/10 to-transparent',
          border: 'hover:border-amber-500/40',
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          gradient: 'from-rose-500/10 to-transparent',
          border: 'hover:border-rose-500/40',
        };
      case 'violet':
        return {
          iconBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
          gradient: 'from-violet-500/10 to-transparent',
          border: 'hover:border-violet-500/40',
        };
      default:
        return {
          iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          gradient: 'from-indigo-500/10 to-transparent',
          border: 'hover:border-indigo-500/40',
        };
    }
  };

  const style = getColorStyles(color);

  return (
    <div className={`relative p-6 bg-slate-900 border border-slate-800 ${style.border} rounded-3xl shadow-xl transition-all duration-300 group overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${style.gradient} pointer-events-none rounded-bl-full opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-2xl ${style.iconBg} border flex items-center justify-center shadow-inner`}>
          {icon}
        </div>

        {isPlaceholder ? (
          <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full">
            Future ML
          </span>
        ) : trend ? (
          <span
            className={`px-2 py-0.5 text-xs font-mono font-semibold rounded-full flex items-center gap-1 ${
              trend === 'up'
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                : 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'} Benchmark
          </span>
        ) : null}
      </div>

      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
          {title}
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-3xl font-extrabold text-slate-100 font-sans tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value ?? '0'}
          </span>
          {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
        </div>
        {label && <p className="text-[11px] text-slate-500 mt-1.5">{label}</p>}
      </div>
    </div>
  );
}
