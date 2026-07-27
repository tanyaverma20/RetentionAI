import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function EmployeeInsightsCard({ insights = {} }) {
  const [activeTab, setActiveTab] = useState('recentHires'); // 'recentHires' | 'anniversaries' | 'birthdays'

  const recentHires = insights.recentHires || [];
  const anniversaries = insights.upcomingAnniversaries || [];
  const birthdays = insights.upcomingBirthdays || [];

  const getActiveList = () => {
    switch (activeTab) {
      case 'anniversaries':
        return anniversaries;
      case 'birthdays':
        return birthdays;
      default:
        return recentHires;
    }
  };

  const list = getActiveList();

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Employee Career Insights
          </h3>
          <span className="text-xs text-slate-500 font-mono">Milestones</span>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 pt-3 border-b border-slate-800/60 pb-3">
          <button
            onClick={() => setActiveTab('recentHires')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'recentHires'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Recent Hires ({recentHires.length})
          </button>
          <button
            onClick={() => setActiveTab('anniversaries')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'anniversaries'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Anniversaries ({anniversaries.length})
          </button>
          <button
            onClick={() => setActiveTab('birthdays')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'birthdays'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Birthdays ({birthdays.length})
          </button>
        </div>

        {/* List Content */}
        <div className="divide-y divide-slate-800/60 pt-2">
          {list.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No milestones recorded for this view.
            </div>
          ) : (
            list.map((emp) => {
              const empId = emp._id || emp.id;
              const dept = emp.departmentId;

              return (
                <div key={empId} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-300 text-xs">
                      {emp.firstName?.[0]}
                      {emp.lastName?.[0]}
                    </div>
                    <div>
                      <Link
                        to={`/employees/${empId}`}
                        className="text-xs font-bold text-slate-200 hover:text-indigo-300 transition-colors"
                      >
                        {emp.firstName} {emp.lastName}
                      </Link>
                      <p className="text-[11px] text-slate-400">
                        {emp.designation} • <span className="text-indigo-400">{dept?.code || 'HQ'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {activeTab === 'anniversaries' ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        {emp.yearsCompleted || 1} Yr Anniversary
                      </span>
                    ) : activeTab === 'birthdays' ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full">
                        {emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Upcoming'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : 'Joined Recent'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800 text-center">
        <Link to="/employees" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
          View All Workforce Records →
        </Link>
      </div>
    </div>
  );
}
