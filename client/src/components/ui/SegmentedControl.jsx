import React from 'react';

/**
 * Pill-style segmented toggle (e.g. Day/Week) — light gray track, white
 * active segment with a soft shadow, matching the reference design.
 *
 * `options`: [{ value, label }]
 */
export default function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-0.5 p-1 bg-slate-100 rounded-xl ${className}`} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              active ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
