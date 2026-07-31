import React from 'react';

// Full, static class strings only — Tailwind's JIT scanner reads source
// files as plain text, so a template literal like `bg-${accent}-100` can
// never be resolved at build time and would silently emit no CSS at all.
const ACCENT_BLOBS = {
  indigo: 'bg-indigo-100/60',
  emerald: 'bg-emerald-100/60',
  amber: 'bg-amber-100/60',
  rose: 'bg-rose-100/60',
  violet: 'bg-violet-100/60',
};

/**
 * Base card surface for the light theme: white background, 24px radius
 * (Tailwind's `rounded-3xl` is exactly 24px), soft diffused shadow instead
 * of the old dark theme's colored glow shadows, subtle 1px border.
 *
 * `accent` optionally renders the soft corner-blob decoration seen in the
 * reference design (e.g. behind empty states / KPI tiles). Pass one of the
 * keys in ACCENT_BLOBS above, or omit it.
 */
export default function Card({ as: As = 'div', accent, className = '', children, ...props }) {
  const blobClass = accent && ACCENT_BLOBS[accent];
  return (
    <As
      className={`relative bg-white border border-slate-100 rounded-3xl shadow-card overflow-hidden ${className}`}
      {...props}
    >
      {blobClass && (
        <div
          className={`absolute -top-6 -right-6 w-32 h-32 rounded-full ${blobClass} pointer-events-none blur-2xl`}
          aria-hidden="true"
        />
      )}
      <div className="relative">{children}</div>
    </As>
  );
}

/** Standard card header row: title + optional subtitle on the left, actions on the right. */
export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
