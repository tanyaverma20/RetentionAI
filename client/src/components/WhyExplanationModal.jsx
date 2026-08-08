import React, { useEffect, useState } from 'react';
import { aiService } from '../services/aiService';

const extractErrorMessage = (err, fallback) =>
  err?.response?.data?.error?.message || err?.message || fallback;

/**
 * Lightweight modal used from the Employee Directory's "Why?" action.
 * Shows the top SHAP contributors for one employee without navigating away
 * from the list. Reuses the same explain endpoints as the Employee Profile.
 */
export default function WhyExplanationModal({ employee, onClose }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const employeeId = employee?._id || employee?.id;

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    setExplanation(null);
    aiService.getExplanation(employeeId)
      .then(setExplanation)
      .catch((err) => {
        if (err?.response?.status === 404) {
          setExplanation(null); // No explanation yet — show the generate CTA, not an error.
        } else {
          setError(extractErrorMessage(err, 'Unable to load this explanation.'));
        }
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (!employee) return null;

  const allFactors = [
    ...(explanation?.topPositiveFactors || []).map((f) => ({ ...f, isPositive: true })),
    ...(explanation?.topNegativeFactors || []).map((f) => ({ ...f, isPositive: false })),
  ].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 bg-white border border-slate-100 rounded-2xl shadow-card space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono font-semibold uppercase tracking-widest text-amber-600">Why is this employee at risk?</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {employee.firstName} {employee.lastName}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs">{error}</div>
        )}

        {!loading && !error && !explanation && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 mb-4">No explanation generated yet. Run batch SHAP explanations from the dashboard to populate this data.</p>
          </div>
        )}

        {!loading && explanation && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-slate-800 leading-relaxed">
              {explanation.summary}
            </div>

            {allFactors.length > 0 && (
              <div className="space-y-2">
                {allFactors.slice(0, 6).map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      f.isPositive ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{f.displayName}</div>
                      <div className="text-xs text-slate-400">{f.formattedValue}</div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${f.isPositive ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                      {f.isPositive ? '+' : ''}{(f.shapValue * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
