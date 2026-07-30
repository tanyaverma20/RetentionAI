import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { decisionService } from '../services/decisionService';
import { RECOMMENDATION_TYPE_LABELS } from '../components/analytics/AnalyticsCharts';

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export default function ManagerDashboard() {
  const { user } = useSelector((state) => state.auth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    decisionService.getManagerDashboard(user?.departmentId)
      .then(setData)
      .catch((err) => setError(extractErrorMessage(err, 'Unable to load your team dashboard.')))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-2xl">⚠️</div>
        <h2 className="text-lg font-bold text-slate-100">Unable to load team dashboard</h2>
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  const teamRisk = data?.teamRisk || { HIGH: 0, MEDIUM: 0, LOW: 0 };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest mb-1">
          <span>Manager Dashboard</span>
          <span>•</span>
          <span>{data?.teamSize ?? 0} Team Members</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100">My Team</h1>
        <p className="text-sm text-slate-400 mt-1">Risk overview, pending actions, and top concerns for your department.</p>
      </div>

      {/* Team Risk */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'High Risk', count: teamRisk.HIGH, color: 'rose' },
          { label: 'Medium Risk', count: teamRisk.MEDIUM, color: 'amber' },
          { label: 'Low Risk', count: teamRisk.LOW, color: 'emerald' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`p-5 bg-slate-900 border border-${color}-500/20 rounded-3xl flex items-center gap-4 shadow-xl`}>
            <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 flex items-center justify-center text-2xl font-black text-${color}-400`}>
              {count}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">{label}</div>
              <div className="text-xs text-slate-500">Team members with an active recommendation at this level</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Priority Employees */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <h2 className="text-base font-bold text-slate-100 mb-4">Priority Employees</h2>
          <div className="space-y-2">
            {(data?.priorityEmployees || []).length === 0 && (
              <p className="text-center text-xs text-slate-500 italic py-6">No high-priority team members right now.</p>
            )}
            {(data?.priorityEmployees || []).map((e) => (
              <Link key={e.employeeId} to={`/employees/${e.employeeId}`} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 hover:border-indigo-500/30 rounded-xl text-xs transition-colors">
                <span className="font-semibold text-slate-200">{e.employeeName}</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase">
                  {RECOMMENDATION_TYPE_LABELS[e.recommendationType] || e.recommendationType}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <h2 className="text-base font-bold text-slate-100 mb-4">Pending Actions</h2>
          <div className="space-y-2">
            {(data?.pendingActions || []).length === 0 && (
              <p className="text-center text-xs text-slate-500 italic py-6">Nothing pending for your team.</p>
            )}
            {(data?.pendingActions || []).map((a) => (
              <Link key={a.decisionId} to={`/employees/${a.employeeId}`} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 hover:border-indigo-500/30 rounded-xl text-xs transition-colors">
                <span className="font-semibold text-slate-200">{a.employeeName}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${a.priority === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : a.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {RECOMMENDATION_TYPE_LABELS[a.recommendationType] || a.recommendationType}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommended Interventions */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <h2 className="text-base font-bold text-slate-100 mb-4">Recommended Interventions</h2>
          <div className="space-y-2">
            {Object.entries(data?.recommendedInterventions || {}).length === 0 && (
              <p className="text-center text-xs text-slate-500 italic py-6">No recommendations generated yet for your team.</p>
            )}
            {Object.entries(data?.recommendedInterventions || {})
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                  <span className="text-slate-200">{RECOMMENDATION_TYPE_LABELS[type] || type}</span>
                  <span className="font-mono text-indigo-400">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Top Concerns */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <h2 className="text-base font-bold text-slate-100 mb-4">Top Concerns</h2>
          <div className="space-y-2">
            {(data?.topConcerns || []).length === 0 && (
              <p className="text-center text-xs text-slate-500 italic py-6">No dominant concerns identified yet.</p>
            )}
            {(data?.topConcerns || []).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                <span className="text-slate-200">{c.factor}</span>
                <span className="font-mono text-slate-400">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
