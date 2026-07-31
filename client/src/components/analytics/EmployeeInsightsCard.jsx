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
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Employee Career Insights
          </h3>
          <span className="text-xs text-slate-400 font-mono">Milestones</span>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 pt-3 border-b border-slate-100/60 pb-3">
          <button
            onClick={() => setActiveTab('recentHires')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'recentHires'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            Recent Hires ({recentHires.length})
          </button>
          <button
            onClick={() => setActiveTab('anniversaries')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'anniversaries'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            Anniversaries ({anniversaries.length})
          </button>
          <button
            onClick={() => setActiveTab('birthdays')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
              activeTab === 'birthdays'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            Birthdays ({birthdays.length})
          </button>
        </div>

        {/* List Content */}
        <div className="divide-y divide-slate-100/60 pt-2">
          {list.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No milestones recorded for this view.
            </div>
          ) : (
            list.map((emp) => {
              const empId = emp._id || emp.id;
              const dept = emp.departmentId;

              return (
                <div key={empId} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-100/30 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-indigo-600 text-xs">
                      {emp.firstName?.[0]}
                      {emp.lastName?.[0]}
                    </div>
                    <div>
                      <Link
                        to={`/employees/${empId}`}
                        className="text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors"
                      >
                        {emp.firstName} {emp.lastName}
                      </Link>
                      <p className="text-[11px] text-slate-500">
                        {emp.designation} • <span className="text-indigo-600">{dept?.code || 'HQ'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {activeTab === 'anniversaries' ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full">
                        {emp.yearsCompleted || 1} Yr Anniversary
                      </span>
                    ) : activeTab === 'birthdays' ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-full">
                        {emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Upcoming'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full">
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

      <div className="pt-2 border-t border-slate-100 text-center">
        <Link to="/employees" className="text-xs font-semibold text-indigo-600 hover:text-indigo-600 transition-colors">
          View All Workforce Records →
        </Link>
      </div>
    </div>
  );
}
