import React from 'react';

// Static class strings only (see Card.jsx) — Tailwind can't resolve
// dynamically interpolated class names at build time.
const VARIANTS = {
  primary:
    'bg-indigo-600 text-white shadow-soft hover:bg-indigo-500 hover:shadow-card disabled:hover:bg-indigo-600',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white shadow-soft hover:bg-rose-500',
  dangerGhost: 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
};

/**
 * Shared button primitive for the light theme. Renders a plain <button> by
 * default; pass `as="a"`/Link-compatible props via `as` for link-styled
 * buttons (e.g. `as={Link}` from react-router-dom).
 */
export default function Button({
  as: As = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <As
      className={`inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}
