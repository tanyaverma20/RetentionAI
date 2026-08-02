import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { fetchAiFeatureImportance } from '../store/slices/analyticsSlice';
import AuthenticatedImage from '../components/AuthenticatedImage';

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
      <div className="relative overflow-hidden p-8 rounded-3xl bg-white border border-slate-100 shadow-card">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-600 text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Machine Learning Engine
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900">Global AI Insights</h1>
            <p className="text-slate-500 mt-2 text-sm max-w-xl">
              Understand the overarching factors driving attrition across the entire organisation using SHAP (SHapley Additive exPlanations).
            </p>
          </div>
        </div>
      </div>

      {aiError && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm">
          {aiError}
        </div>
      )}

      {/* ── Global Feature Importance Chart ── */}
      <section className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Top Drivers of Attrition (Global)</h2>
          <p className="text-slate-500 text-sm mt-1">
            Features ranked by mean absolute SHAP value. A higher bar indicates the feature has a stronger overall impact on attrition risk across the workforce.
          </p>
        </div>

        {aiLoading ? (
          <div className="h-80 animate-pulse bg-slate-100 rounded-2xl" />
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
        <section className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Global SHAP Summary</h2>
            <p className="text-slate-500 text-sm mt-1">
              Displays the distribution of impacts for each feature. Color represents the feature value (red = high, blue = low).
            </p>
          </div>
          <div className="flex-1 bg-white rounded-2xl overflow-hidden flex items-center justify-center p-4">
            <AuthenticatedImage
              path="/analytics/ai/plots/global/summaryBeeswarm?n_samples=100"
              alt="Global SHAP Summary Plot"
              className="max-w-full h-auto object-contain mix-blend-multiply"
              fallbackLabel="Summary plot unavailable"
            />
          </div>
        </section>

        {/* Dependence Plot */}
        <section className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Feature Dependence</h2>
              <p className="text-slate-500 text-sm mt-1">
                How a single feature affects risk across the workforce.
              </p>
            </div>
            <select
              value={featureForDependence}
              onChange={(e) => setFeatureForDependence(e.target.value)}
              className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-violet-500 focus:border-violet-500 block p-2.5"
            >
              {chartData.slice(0, 10).map((f) => (
                <option key={f.featureKey} value={f.featureKey}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 bg-white rounded-2xl overflow-hidden flex items-center justify-center p-4">
            <AuthenticatedImage
              path={`/analytics/ai/plots/global/dependence?feature=${featureForDependence}&n_samples=100`}
              alt="Global SHAP Dependence Plot"
              className="max-w-full h-auto object-contain mix-blend-multiply"
              fallbackLabel="Dependence plot unavailable"
            />
          </div>
        </section>
        
      </div>
    </div>
  );
}
