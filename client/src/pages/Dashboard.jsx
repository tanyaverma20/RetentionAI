import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import KpiCard from '../components/analytics/KpiCard';
import {
  EmployeesByDepartmentChart,
  EmployeesByGenderChart,
  EmployeesByEmploymentTypeChart,
  MonthlyHiringTrendChart,
  MonthlyAttritionTrendChart,
  ExperienceDistributionChart,
} from '../components/analytics/AnalyticsCharts';
import DepartmentAnalyticsTable from '../components/analytics/DepartmentAnalyticsTable';
import EmployeeInsightsCard from '../components/analytics/EmployeeInsightsCard';
import AnalyticsFilterBar from '../components/analytics/AnalyticsFilterBar';

import { fetchDashboardSummary, setAnalyticsFilter, resetAnalyticsFilters } from '../store/slices/analyticsSlice';
import { fetchDepartments } from '../store/slices/departmentSlice';

// KPI icon helpers
function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function UserCheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1" />
    </svg>
  );
}
function TrendUpIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function SmileIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function CalendarCheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
function AcademicCapIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </svg>
  );
}
function SparklesIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function KpiSkeleton() {
  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-800" />
        <div className="w-16 h-5 rounded-full bg-slate-800" />
      </div>
      <div className="w-24 h-3 rounded bg-slate-800 mb-3" />
      <div className="w-16 h-8 rounded bg-slate-800" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl animate-pulse">
      <div className="w-40 h-4 rounded bg-slate-800 mb-2" />
      <div className="w-56 h-3 rounded bg-slate-800 mb-6" />
      <div className="h-64 rounded-xl bg-slate-800/60" />
    </div>
  );
}

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { departments } = useSelector((state) => state.department);
  const {
    kpis,
    departmentStats,
    demographics,
    monthlyTrends,
    insights,
    filters,
    loading,
    error,
  } = useSelector((state) => state.analytics);

  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v),
  );

  useEffect(() => {
    dispatch(fetchDepartments());
    dispatch(fetchDashboardSummary(activeFilters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const handleFilterChange = (key, value) => {
    const updated = { ...filters, [key]: value };
    dispatch(setAnalyticsFilter({ [key]: value }));
    const nonEmpty = Object.fromEntries(Object.entries(updated).filter(([, v]) => v));
    dispatch(fetchDashboardSummary(nonEmpty));
  };

  const handleResetFilters = () => {
    dispatch(resetAnalyticsFilters());
    dispatch(fetchDashboardSummary({}));
  };

  const getRoleDisplayName = (role) => {
    const map = {
      ADMIN: 'Administrator',
      HR_MANAGER: 'HR Manager',
      DEPARTMENT_MANAGER: 'Department Manager',
      DEPT_MANAGER: 'Department Manager',
      EMPLOYEE: 'Employee',
    };
    return map[role] || role;
  };

  return (
    <div className="space-y-8">

          {/* ── Welcome Banner ── */}
          <div className="relative overflow-hidden p-8 rounded-3xl bg-gradient-to-r from-indigo-900/70 via-slate-900 to-slate-900 border border-indigo-500/20 shadow-2xl">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%236366f1\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Analytics Dashboard
                </div>
                <h1 className="text-3xl font-extrabold text-white">
                  Welcome back, {user?.firstName || user?.name?.split(' ')[0] || 'User'}!
                </h1>
                <p className="text-slate-300 mt-2 text-sm max-w-xl">
                  Here's your workforce intelligence overview for RetentionAI.
                  {user?.role && (
                    <span className="ml-1 font-semibold text-indigo-300">
                      Viewing as: {getRoleDisplayName(user.role)}.
                    </span>
                  )}
                </p>
              </div>

              {/* User Profile Summary */}
              <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-700 rounded-2xl p-4 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/30">
                  {(user?.firstName || user?.name || 'U')[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{user?.name}</p>
                  <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                  <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Filter Bar ── */}
          <AnalyticsFilterBar
            filters={filters}
            departments={departments}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          {/* ── KPI Cards ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">Key Performance Indicators</h2>
              <span className="text-xs font-mono text-slate-500">Real-time workforce metrics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {loading && !kpis ? (
                Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
              ) : (
                <>
                  <KpiCard title="Total Employees" value={kpis?.totalEmployees} color="indigo" icon={<UsersIcon />} label="All workforce records" />
                  <KpiCard title="Active Employees" value={kpis?.activeEmployees} color="emerald" icon={<UserCheckIcon />} label="Currently employed & active" />
                  <KpiCard title="Departments" value={kpis?.departmentCount} color="violet" icon={<BuildingIcon />} label="Active organizational units" />
                  <KpiCard title="New Hires (30d)" value={kpis?.newHires30Days} color="amber" icon={<TrendUpIcon />} label="Onboarded this month" />
                  <KpiCard title="Attendance Today" value={kpis?.attendanceToday} color="emerald" icon={<CalendarCheckIcon />} label="Present employees today" />
                  <KpiCard title="Avg Performance" value={kpis?.avgPerformance} unit="/ 5" color="indigo" icon={<StarIcon />} label="Company-wide average rating" />
                  <KpiCard title="Promotions Due" value={kpis?.promotionDue} color="amber" icon={<SparklesIcon />} label="Recommended for promotion" />
                  <KpiCard title="Trained Staff" value={kpis?.trainingCompletion} unit="%" color="sky" icon={<AcademicCapIcon />} label="Completed at least 1 training" />
                  <KpiCard
                    title="Attrition Benchmark"
                    value={kpis?.attritionRate?.value}
                    unit={kpis?.attritionRate?.unit}
                    trend={kpis?.attritionRate?.trend}
                    isPlaceholder={kpis?.attritionRate?.isPlaceholder}
                    label="Monthly rate across org"
                    color="rose"
                    icon={<ChartIcon />}
                  />
                  <KpiCard
                    title="Employee Satisfaction"
                    value={kpis?.employeeSatisfaction?.value}
                    unit={kpis?.employeeSatisfaction?.unit}
                    trend={kpis?.employeeSatisfaction?.trend}
                    isPlaceholder={kpis?.employeeSatisfaction?.isPlaceholder}
                    label={kpis?.employeeSatisfaction?.label}
                    color="emerald"
                    icon={<SmileIcon />}
                  />
                </>
              )}
            </div>
          </section>

          {/* ── Charts Grid ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-100">Analytics & Workforce Insights</h2>
              <Link to="/analytics/departments" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                View Department Analytics →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading && !demographics?.byDepartment?.length ? (
                Array.from({ length: 6 }).map((_, i) => <ChartSkeleton key={i} />)
              ) : (
                <>
                  <EmployeesByDepartmentChart data={demographics?.byDepartment || []} />
                  <EmployeesByGenderChart data={demographics?.byGender || []} />
                  <EmployeesByEmploymentTypeChart data={demographics?.byEmploymentType || []} />
                  <div className="md:col-span-2">
                    <MonthlyHiringTrendChart data={monthlyTrends || []} />
                  </div>
                  <MonthlyAttritionTrendChart data={monthlyTrends || []} />
                  <div className="md:col-span-2 xl:col-span-3">
                    <ExperienceDistributionChart data={demographics?.experienceDistribution || []} />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Department Stats ── */}
          <section>
            {loading && !departmentStats?.length ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-48 bg-slate-800 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-slate-900 border border-slate-800 rounded-3xl" />
                  ))}
                </div>
              </div>
            ) : (
              <DepartmentAnalyticsTable departmentStats={departmentStats || []} />
            )}
          </section>

          {/* ── Employee Insights ── */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-100">Workforce Milestones & Insights</h2>
              <p className="text-xs text-slate-400">Recent joiners, work anniversaries, and upcoming birthdays</p>
            </div>
            {loading && !insights?.recentHires?.length ? (
              <ChartSkeleton />
            ) : (
              <EmployeeInsightsCard insights={insights || {}} />
            )}
          </section>

    </div>
  );
}
