import React from 'react';

export default function DepartmentAnalyticsTable({ departmentStats = [] }) {
  if (!departmentStats || departmentStats.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-slate-100 rounded-3xl">
        <p className="text-slate-500 text-sm">No department analytics data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Department Overview & Leadership</h2>
          <p className="text-xs text-slate-500">Headcount, average experience, and manager allocations per division</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departmentStats.map((dept) => (
          <div
            key={dept._id || dept.departmentId}
            className="p-6 bg-white border border-slate-100 hover:border-indigo-100 rounded-3xl shadow-card space-y-4 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  {dept.departmentCode}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{dept.departmentName}</h3>
                <p className="text-xs text-slate-400">{dept.location || 'Main HQ'}</p>
              </div>

              <div className="text-right">
                <span className="text-2xl font-black text-slate-900">{dept.employeeCount}</span>
                <p className="text-[10px] font-mono uppercase text-slate-400">Staff Count</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100/80 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Active Staff</span>
                <span className="text-sm font-bold text-emerald-600">{dept.activeEmployees}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Avg Tenure</span>
                <span className="text-sm font-bold text-indigo-600">{dept.avgExperienceYears || 0} Yrs</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                {dept.manager ? dept.manager.name?.[0] : '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{dept.manager ? dept.manager.name : 'Unassigned'}</p>
                <p className="text-[10px] text-slate-400 font-mono">Department Manager</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
