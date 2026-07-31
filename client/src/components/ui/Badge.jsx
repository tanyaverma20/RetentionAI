import React from 'react';

// Static class strings only (see Card.jsx note on Tailwind's JIT scanner).
const TONES = {
  neutral: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
};

/** Small rounded pill — matches the reference design's "Lab"/"Lecture" tags and role badges. */
export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
