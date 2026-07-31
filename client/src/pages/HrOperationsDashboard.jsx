import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflowDashboardService } from '../services/workflowService';

const KPI_TILE_STYLES = {
  indigo: { border: 'border-indigo-100', text: 'text-indigo-600' },
  rose: { border: 'border-rose-100', text: 'text-rose-600' },
  emerald: { border: 'border-emerald-100', text: 'text-emerald-600' },
  amber: { border: 'border-amber-100', text: 'text-amber-600' },
  sky: { border: 'border-sky-100', text: 'text-sky-600' },
};

function KpiTile({ label, value, accent = 'indigo' }) {
  const styles = KPI_TILE_STYLES[accent] || KPI_TILE_STYLES.indigo;
  return (
    <div className={`p-5 bg-white border ${styles.border} rounded-3xl shadow-card`}>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</div>
      <div className={`text-3xl font-black ${styles.text} mt-2`}>{value}</div>
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card">
      <h2 className="text-base font-bold text-slate-900 mb-4">{icon} {title}</h2>
      {children}
    </div>
  );
}

export default function HrOperationsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadTimeMs, setLoadTimeMs] = useState(null);

  useEffect(() => {
    const start = performance.now();
    workflowDashboardService.getDashboard().then((d) => {
      setData(d);
      setLoadTimeMs(Math.round(performance.now() - start));
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">HR Operations Dashboard</h1>
        <p className="text-xs text-slate-400 mt-1">
          Generated {new Date(data.generatedAt).toLocaleString()}{loadTimeMs != null && ` · loaded in ${loadTimeMs}ms`}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Pending Approvals" value={data.pendingApprovals} accent="amber" />
        <KpiTile label="Open Interventions" value={data.openInterventions} accent="indigo" />
        <KpiTile label="Tasks Due Today" value={data.tasksDueToday} accent="sky" />
        <KpiTile label="Overdue Tasks" value={data.overdueTasks} accent="rose" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiTile label="Avg. Completion Time" value={data.avgCompletionTimeHours != null ? `${data.avgCompletionTimeHours}h` : 'N/A'} accent="emerald" />
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-card flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Quick Links</span>
          <div className="flex gap-2">
            <Link to="/interventions" className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Interventions</Link>
            <Link to="/tasks" className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg">Tasks</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="High Priority Actions" icon="🔥">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.highPriorityActions.tasks.map((t) => (
              <div key={t._id} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Task: {t.title}</span>
                <span className="text-slate-400">{t.ownerUserId?.name || 'Unassigned'}</span>
              </div>
            ))}
            {data.highPriorityActions.interventions.map((iv) => (
              <div key={iv._id} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Intervention: {iv.title}</span>
                <span className="text-slate-400">{iv.employeeId?.firstName} {iv.employeeId?.lastName}</span>
              </div>
            ))}
            {data.highPriorityActions.tasks.length === 0 && data.highPriorityActions.interventions.length === 0 && (
              <p className="text-center text-xs text-slate-400 italic py-6">No open high-priority items.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recently Completed" icon="✅">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentlyCompleted.tasks.map((t) => (
              <div key={t._id} className="text-xs text-slate-600 p-2 bg-slate-50 rounded-lg">Task: {t.title}</div>
            ))}
            {data.recentlyCompleted.interventions.map((iv) => (
              <div key={iv._id} className="text-xs text-slate-600 p-2 bg-slate-50 rounded-lg">Intervention: {iv.title}</div>
            ))}
            {data.recentlyCompleted.tasks.length === 0 && data.recentlyCompleted.interventions.length === 0 && (
              <p className="text-center text-xs text-slate-400 italic py-6">Nothing completed yet.</p>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Department Workload" icon="🏢">
          <div className="space-y-2">
            {data.departmentWorkload.map((d) => (
              <div key={d.departmentName} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">{d.departmentName}</span>
                <span className="text-indigo-600 font-bold">{d.count}</span>
              </div>
            ))}
            {data.departmentWorkload.length === 0 && <p className="text-center text-xs text-slate-400 italic py-6">No open tasks assigned to a department yet.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Manager Workload" icon="👤">
          <div className="space-y-2">
            {data.managerWorkload.map((m) => (
              <div key={m.userId} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-600">{m.name}</span>
                <span className="text-indigo-600 font-bold">{m.count}</span>
              </div>
            ))}
            {data.managerWorkload.length === 0 && <p className="text-center text-xs text-slate-400 italic py-6">No open tasks assigned yet.</p>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
