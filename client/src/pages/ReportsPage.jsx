import React from 'react';
import api from '../services/api';

const reports = [
  ['employees', 'Employee Summary', 'Directory, status, designation and joining details'],
  ['departments', 'Department Summary', 'Headcount and department ownership'],
  ['attendance', 'Attendance Report', 'Attendance, leave, hours and work mode'],
  ['performance', 'Performance Report', 'Review scores and promotion recommendations'],
  ['training', 'Training Report', 'Learning completions and certifications'],
];

export default function ReportsPage() {
  const download = async (slug) => {
    const response = await api.get(`/reports/${slug}/csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${slug}-report.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-6"><header className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl"><p className="text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">Reporting centre</p><h1 className="mt-1 text-3xl font-extrabold text-slate-100">Workforce Reports</h1><p className="mt-2 text-sm text-slate-400">Download CSV reports. PDF export remains API-ready for the next delivery.</p></header><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{reports.map(([slug, title, description]) => <article key={slug} className="p-6 rounded-3xl bg-slate-900 border border-slate-800"><h2 className="font-bold text-slate-100">{title}</h2><p className="mt-2 text-sm text-slate-400 min-h-10">{description}</p><button onClick={() => download(slug)} className="mt-5 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">Export CSV</button></article>)}</div></div>;
}
