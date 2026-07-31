import React, { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { executiveService } from '../services/executiveService';

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

const SEVERITY_STYLES = {
  CRITICAL: 'bg-rose-50 text-rose-600 border-rose-100',
  HIGH: 'bg-orange-50 text-orange-600 border-orange-100',
  MEDIUM: 'bg-amber-50 text-amber-600 border-amber-100',
  LOW: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

const KPI_TILE_STYLES = {
  indigo: { border: 'border-indigo-100', text: 'text-indigo-600' },
  rose: { border: 'border-rose-100', text: 'text-rose-600' },
  emerald: { border: 'border-emerald-100', text: 'text-emerald-600' },
  amber: { border: 'border-amber-100', text: 'text-amber-600' },
  sky: { border: 'border-sky-100', text: 'text-sky-600' },
};

function KpiTile({ label, value, sub, accent = 'indigo' }) {
  const styles = KPI_TILE_STYLES[accent] || KPI_TILE_STYLES.indigo;
  return (
    <div className={`p-5 bg-white border ${styles.border} rounded-3xl shadow-card`}>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</div>
      <div className={`text-3xl font-black ${styles.text} mt-2`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon, children, className = '' }) {
  return (
    <div className={`p-6 bg-white border border-slate-100 rounded-3xl shadow-card ${className}`}>
      <h2 className="text-base font-bold text-slate-900 mb-4">{icon} {title}</h2>
      {children}
    </div>
  );
}

function riskColor(score) {
  if (score == null) return 'bg-slate-100 text-slate-400';
  if (score >= 0.6) return 'bg-rose-50 text-rose-600';
  if (score >= 0.35) return 'bg-amber-50 text-amber-600';
  if (score >= 0.15) return 'bg-yellow-50 text-yellow-600';
  return 'bg-emerald-50 text-emerald-600';
}

export default function ExecutiveDashboard() {
  const [filter, setFilter] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights] = useState([]);
  const [intervention, setIntervention] = useState(null);
  const [roi, setRoi] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [loadTimeMs, setLoadTimeMs] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const start = performance.now();
    try {
      const [d, i, iv, r, f, a] = await Promise.all([
        executiveService.getDashboard(filter),
        executiveService.getInsights(filter),
        executiveService.getInterventionAnalytics(filter),
        executiveService.getRoiAnalytics(filter),
        executiveService.getForecast(filter),
        executiveService.listAlerts('OPEN'),
      ]);
      setDashboard(d);
      setInsights(i);
      setIntervention(iv);
      setRoi(r);
      setForecast(f);
      setAlerts(a);
      setLoadTimeMs(Math.round(performance.now() - start));
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load the Executive Dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (key, value) => {
    setFilter((prev) => {
      const next = { ...prev };
      if (value) next[key] = value; else delete next[key];
      return next;
    });
  };

  const handleGenerateAlerts = async () => {
    await executiveService.generateAlerts(filter);
    const a = await executiveService.listAlerts('OPEN');
    setAlerts(a);
  };

  const handleAlertAction = async (id, action) => {
    if (action === 'dismiss') await executiveService.dismissAlert(id);
    else if (action === 'review') await executiveService.reviewAlert(id);
    setAlerts(await executiveService.listAlerts('OPEN'));
  };

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      await executiveService.downloadReport(format, filter);
    } finally {
      setDownloading('');
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-white border border-slate-100 rounded-3xl space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-2xl">⚠️</div>
        <h2 className="text-lg font-bold text-slate-900">Unable to load Executive Dashboard</h2>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  const ch = dashboard.companyHealth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-600 uppercase tracking-widest mb-1">
              <span>🏛️ Executive Workforce Intelligence Center</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900">Company Overview</h1>
            <p className="text-sm text-slate-500 mt-1">
              Generated {new Date(dashboard.generatedAt).toLocaleString()} · {dashboard.scope.employeeCount} employees in scope
              {loadTimeMs != null && <span className="text-slate-400"> · loaded in {loadTimeMs}ms</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleDownload('pdf')} disabled={downloading === 'pdf'} className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl disabled:opacity-50">
              {downloading === 'pdf' ? 'Generating…' : '📄 PDF'}
            </button>
            <button onClick={() => handleDownload('docx')} disabled={downloading === 'docx'} className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50">
              {downloading === 'docx' ? 'Generating…' : '📝 DOCX'}
            </button>
            <button onClick={() => handleDownload('csv')} disabled={downloading === 'csv'} className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-50">
              {downloading === 'csv' ? 'Generating…' : '📊 CSV'}
            </button>
          </div>
        </div>

        {/* Part 4 — Filters */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <select onChange={(e) => handleFilterChange('departmentId', e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
            <option value="">All Departments</option>
            {dashboard.departmentHealth.map((d) => d.departmentId && (
              <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
            ))}
          </select>
          <select onChange={(e) => handleFilterChange('gender', e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <select onChange={(e) => handleFilterChange('riskLevel', e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
            <option value="">All Risk Levels</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>
          <input type="number" placeholder="Min Experience (yrs)" onChange={(e) => handleFilterChange('minExperienceYears', e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600 w-40" />
          <input type="date" onChange={(e) => handleFilterChange('startDate', e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600" />
          <input type="date" onChange={(e) => handleFilterChange('endDate', e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiTile label="Company Health Score" value={`${ch.score}/100`} accent="indigo" />
        <KpiTile label="Overall Attrition Risk" value={`${ch.overallAttritionRisk}%`} accent="rose" />
        <KpiTile label="Retention Score" value={`${ch.retentionScore}%`} accent="emerald" />
        <KpiTile label="Average Burnout" value={`${ch.avgBurnout}%`} accent="amber" />
        <KpiTile label="Employee Satisfaction" value={`${ch.employeeSatisfaction}%`} accent="sky" />
      </div>

      {/* Critical Departments */}
      {dashboard.criticalDepartments.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
          <h3 className="text-sm font-bold text-rose-600 mb-2">⚠️ Critical Departments Requiring Attention</h3>
          <div className="flex flex-wrap gap-2">
            {dashboard.criticalDepartments.map((d) => (
              <span key={d.departmentName} className="px-3 py-1.5 text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-full">
                {d.departmentName} — Risk {(d.avgRiskScore * 100).toFixed(0)}% / Burnout {(d.avgBurnoutScore * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Department Health + Risk Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Department Health" icon="🏢">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {dashboard.departmentHealth.map((d) => (
              <div key={d.departmentName} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                <div>
                  <div className="font-semibold text-slate-800">{d.departmentName}</div>
                  <div className="text-slate-400">{d.location} · {d.predictedCount} employees analyzed</div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded-full font-bold ${riskColor(d.avgRiskScore)}`}>Risk {(d.avgRiskScore * 100).toFixed(0)}%</span>
                  <span className={`px-2 py-1 rounded-full font-bold ${riskColor(d.avgBurnoutScore)}`}>Burnout {(d.avgBurnoutScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {dashboard.departmentHealth.length === 0 && <p className="text-center text-xs text-slate-400 italic py-8">No department data yet — generate predictions for employees to populate this view.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Risk Heatmap (Department × Risk Level)" icon="🌡️">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {dashboard.riskHeatmap.map((row) => (
              <div key={row.departmentName} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="text-xs font-semibold text-slate-600 mb-2">{row.departmentName} ({row.totalPredicted})</div>
                <div className="flex gap-2">
                  {row.levels.map((l) => (
                    <span key={l.level} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${riskColor(l.avgRiskScore)}`}>{l.level}: {l.count}</span>
                  ))}
                </div>
              </div>
            ))}
            {dashboard.riskHeatmap.length === 0 && <p className="text-center text-xs text-slate-400 italic py-8">No predictions generated yet.</p>}
          </div>
        </SectionCard>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Attrition Risk Trend (12 months)" icon="📈">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dashboard.trends.attritionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
              <Line type="monotone" dataKey="avgRiskScore" stroke="#f43f5e" strokeWidth={2} connectNulls dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Burnout Trend (12 months)" icon="🔥">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dashboard.trends.burnoutTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
              <Line type="monotone" dataKey="avgBurnoutScore" stroke="#f59e0b" strokeWidth={2} connectNulls dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Location Comparison" icon="📍">
          <div className="space-y-2">
            {dashboard.locationComparison.map((l) => (
              <div key={l.location} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">{l.location} ({l.departmentCount} depts)</span>
                <span className={`font-bold ${riskColor(l.avgRiskScore).split(' ')[1]}`}>{(l.avgRiskScore * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Manager Comparison" icon="👤">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {dashboard.managerComparison.slice(0, 8).map((m) => (
              <div key={m.managerId} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">{m.managerName} ({m.teamSize})</span>
                <span className={`font-bold ${riskColor(m.avgRiskScore).split(' ')[1]}`}>{(m.avgRiskScore * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Business Unit Comparison" icon="🏭">
          <p className="text-[10px] text-slate-400 mb-2 italic">Business Unit = Department (no separate hierarchy tracked)</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dashboard.businessUnitComparison.map((d) => (
              <div key={d.departmentName} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">{d.departmentName}</span>
                <span className={`font-bold ${riskColor(d.avgRiskScore).split(' ')[1]}`}>{(d.avgRiskScore * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Intervention + ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Intervention Analytics" icon="🎯">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-xl font-black text-indigo-600">{intervention.overall.totalCreated}</div><div className="text-[10px] text-slate-400">Created</div></div>
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-xl font-black text-emerald-600">{intervention.overall.accepted}</div><div className="text-[10px] text-slate-400">Accepted</div></div>
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-xl font-black text-rose-600">{intervention.overall.rejected}</div><div className="text-[10px] text-slate-400">Rejected</div></div>
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-xl font-black text-amber-600">{intervention.overall.pending}</div><div className="text-[10px] text-slate-400">Pending</div></div>
          </div>
          <p className="text-xs text-slate-500">Success Rate: <span className="text-slate-800 font-semibold">{intervention.overall.successRate != null ? `${(intervention.overall.successRate * 100).toFixed(0)}%` : 'N/A'}</span> · Avg Completion: <span className="text-slate-800 font-semibold">{intervention.overall.avgCompletionTimeHours ?? 'N/A'} hrs</span></p>
        </SectionCard>
        <SectionCard title="ROI Analytics (Estimates)" icon="💰">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-xl font-black text-emerald-600">{roi.employeesRetained}</div><div className="text-[10px] text-slate-400">Retained</div></div>
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-xl font-black text-sky-600">{roi.highValueEmployeesRetained}</div><div className="text-[10px] text-slate-400">High-Value Retained</div></div>
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-lg font-black text-indigo-600">${roi.estimatedHiringCostSavedUsd.toLocaleString()}</div><div className="text-[10px] text-slate-400">Hiring Cost Saved</div></div>
            <div className="p-3 bg-slate-50 rounded-xl text-center"><div className="text-lg font-black text-indigo-600">${roi.estimatedReplacementCostAvoidedUsd.toLocaleString()}</div><div className="text-[10px] text-slate-400">Replacement Avoided</div></div>
          </div>
          <p className="text-[10px] text-slate-400 italic">{roi.assumptions.note}</p>
        </SectionCard>
      </div>

      {/* SHAP / NLP / Knowledge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Top SHAP Drivers" icon="⚖️">
          <div className="space-y-1.5">
            {dashboard.topShapDrivers.map((f) => (
              <div key={f.featureKey} className="flex justify-between text-xs"><span className="text-slate-600">{f.displayName}</span><span className="text-slate-400 font-mono">{(f.meanAbsShap ?? 0).toFixed(3)}</span></div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Top NLP Topics" icon="💬">
          <div className="space-y-1.5">
            {dashboard.topNlpTopics.map((t) => (
              <div key={t.topic} className="flex justify-between text-xs"><span className="text-slate-600">{t.topic}</span><span className="text-slate-400 font-mono">{t.count}</span></div>
            ))}
            {dashboard.topNlpTopics.length === 0 && <p className="text-center text-xs text-slate-400 italic py-4">No topics analyzed yet.</p>}
          </div>
        </SectionCard>
        <SectionCard title="Top Knowledge Categories" icon="📚">
          <div className="space-y-1.5">
            {(dashboard.topKnowledgeCategories || []).map((k, i) => (
              <div key={i} className="text-xs text-slate-600">{k.policy || k.name || JSON.stringify(k)}</div>
            ))}
            {(!dashboard.topKnowledgeCategories || dashboard.topKnowledgeCategories.length === 0) && <p className="text-center text-xs text-slate-400 italic py-4">No knowledge queries recorded yet.</p>}
          </div>
        </SectionCard>
      </div>

      {/* Forecast */}
      <SectionCard title="Forecast — Risk Trajectory" icon="🔮">
        {forecast.sufficientData ? (
          <div className="grid grid-cols-3 gap-4">
            {['day30', 'day60', 'day90'].map((key) => (
              <div key={key} className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <div className="text-xs text-slate-400 mb-1">{forecast.forecast[key].days}-Day Forecast</div>
                <div className={`text-2xl font-black ${riskColor(forecast.forecast[key].projectedValue).split(' ')[1]}`}>{(forecast.forecast[key].projectedValue * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400">CI: {(forecast.forecast[key].confidenceInterval.lower * 100).toFixed(1)}% – {(forecast.forecast[key].confidenceInterval.upper * 100).toFixed(1)}%</div>
              </div>
            ))}
            <div className="col-span-3 text-xs text-slate-500 text-center">Trajectory: <span className="font-bold text-slate-800">{forecast.forecast.riskTrajectory}</span> · Method: {forecast.method} · {forecast.monthsOfHistory} months of history</div>
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400 italic py-6">{forecast.message}</p>
        )}
      </SectionCard>

      {/* Executive Insights */}
      <SectionCard title="Executive Insights" icon="🧠">
        <div className="space-y-3">
          {insights.length === 0 && <p className="text-center text-xs text-slate-400 italic py-6">No significant patterns detected yet — insights populate as more predictions/decisions accumulate over time.</p>}
          {insights.map((insight, i) => (
            <div key={i} className={`p-4 rounded-2xl border ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.LOW}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">{insight.title}</span>
                <span className="text-[10px] font-mono uppercase">{insight.severity} · {(insight.confidence * 100).toFixed(0)}% confidence</span>
              </div>
              <p className="text-xs opacity-90">{insight.recommendedAction}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Alerts */}
      <SectionCard title="Executive Alerts" icon="🚨">
        <div className="flex justify-end mb-3">
          <button onClick={handleGenerateAlerts} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Scan for New Alerts</button>
        </div>
        <div className="space-y-2">
          {alerts.length === 0 && <p className="text-center text-xs text-slate-400 italic py-6">No open alerts.</p>}
          {alerts.map((alert) => (
            <div key={alert._id} className={`flex items-center justify-between p-3 rounded-xl border ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.LOW}`}>
              <div>
                <div className="text-xs font-bold">{alert.title}</div>
                <div className="text-[10px] opacity-80">{alert.description}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAlertAction(alert._id, 'review')} className="px-2 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">Mark Reviewed</button>
                <button onClick={() => handleAlertAction(alert._id, 'dismiss')} className="px-2 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
