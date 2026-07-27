import React from 'react';

export default function DepartmentAnalyticsTable({ departmentStats = [] }) {
  if (!departmentStats || departmentStats.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl">
        <p className="text-slate-400 text-sm">No department analytics data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Department Overview & Leadership</h2>
          <p className="text-xs text-slate-400">Headcount, average experience, and manager allocations per division</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departmentStats.map((dept) => (
          <div
            key={dept._id || dept.departmentId}
            className="p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-3xl shadow-xl space-y-4 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {dept.departmentCode}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">{dept.departmentName}</h3>
                <p className="text-xs text-slate-500">{dept.location || 'Main HQ'}</p>
              </div>

              <div className="text-right">
                <span className="text-2xl font-black text-slate-100">{dept.employeeCount}</span>
                <p className="text-[10px] font-mono uppercase text-slate-500">Staff Count</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Active Staff</span>
                <span className="text-sm font-bold text-emerald-400">{dept.activeEmployees}</span>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Avg Tenure</span>
                <span className="text-sm font-bold text-indigo-400">{dept.avgExperienceYears || 0} Yrs</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                {dept.manager ? dept.manager.name?.[0] : '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-200">{dept.manager ? dept.manager.name : 'Unassigned'}</p>
                <p className="text-[10px] text-slate-500 font-mono">Department Manager</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
