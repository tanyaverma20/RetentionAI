import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { fetchAiFeatureImportance } from '../store/slices/analyticsSlice';
import api from '../services/api';

export default function AiAnalytics() {
  const dispatch = useDispatch();
  const { aiGlobalImportance, aiLoading, aiError } = useSelector((state) => state.analytics);
  const [featureForDependence, setFeatureForDependence] = useState('salary');

  useEffect(() => {
    dispatch(fetchAiFeatureImportance({ n_samples: 100 }));
  }, [dispatch]);

  // Transform features for the bar chart
  const chartData = aiGlobalImportance?.features?.map((f) => ({
    name: f.displayName,
    featureKey: f.featureKey,
    importance: f.meanAbsShap,
  })) || [];

  return (
    <div className="space-y-8">
      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden p-8 rounded-3xl bg-gradient-to-r from-violet-900/70 via-slate-900 to-slate-900 border border-violet-500/20 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%238b5cf6\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-violet-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Machine Learning Engine
            </div>
            <h1 className="text-3xl font-extrabold text-white">Global AI Insights</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Understand the overarching factors driving attrition across the entire organisation using SHAP (SHapley Additive exPlanations).
            </p>
          </div>
        </div>
      </div>

      {aiError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          {aiError}
        </div>
      )}

      {/* ── Global Feature Importance Chart ── */}
      <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100">Top Drivers of Attrition (Global)</h2>
          <p className="text-slate-400 text-sm mt-1">
            Features ranked by mean absolute SHAP value. A higher bar indicates the feature has a stronger overall impact on attrition risk across the workforce.
          </p>
        </div>

        {aiLoading ? (
          <div className="h-80 animate-pulse bg-slate-800/50 rounded-2xl" />
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.slice(0, 10).reverse()} // Top 10, reversed for correct visual order (highest on top)
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#334155" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={150} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8' }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '4px' }}
                  formatter={(value) => [`${value.toFixed(4)}`, 'Mean |SHAP|']}
                />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {chartData.slice(0, 10).reverse().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#ef4444' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── SHAP Plots ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Summary Beeswarm */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-100">Global SHAP Summary</h2>
            <p className="text-slate-400 text-sm mt-1">
              Displays the distribution of impacts for each feature. Color represents the feature value (red = high, blue = low).
            </p>
          </div>
          <div className="flex-1 bg-white rounded-2xl overflow-hidden flex items-center justify-center p-4">
            <img 
              src={`${api.defaults.baseURL}/analytics/ai/plots/global/summaryBeeswarm?n_samples=100`} 
              alt="Global SHAP Summary Plot" 
              className="max-w-full h-auto object-contain mix-blend-multiply"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </section>

        {/* Dependence Plot */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Feature Dependence</h2>
              <p className="text-slate-400 text-sm mt-1">
                How a single feature affects risk across the workforce.
              </p>
            </div>
            <select
              value={featureForDependence}
              onChange={(e) => setFeatureForDependence(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl focus:ring-violet-500 focus:border-violet-500 block p-2.5"
            >
              {chartData.slice(0, 10).map((f) => (
                <option key={f.featureKey} value={f.featureKey}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 bg-white rounded-2xl overflow-hidden flex items-center justify-center p-4">
            <img 
              src={`${api.defaults.baseURL}/analytics/ai/plots/global/dependence?feature=${featureForDependence}&n_samples=100`} 
              alt="Global SHAP Dependence Plot" 
              className="max-w-full h-auto object-contain mix-blend-multiply"
              key={featureForDependence} // force remount/reload on change
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </section>
        
      </div>
    </div>
  );
}
