import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  EmployeesByDepartmentChart,
  EmployeesByGenderChart,
  EmployeesByEmploymentTypeChart,
  MonthlyHiringTrendChart,
  MonthlyAttritionTrendChart,
  ExperienceDistributionChart,
} from '../components/analytics/AnalyticsCharts';
import DepartmentAnalyticsTable from '../components/analytics/DepartmentAnalyticsTable';
import AnalyticsFilterBar from '../components/analytics/AnalyticsFilterBar';

import { fetchDashboardSummary, setAnalyticsFilter, resetAnalyticsFilters } from '../store/slices/analyticsSlice';
import { fetchDepartments } from '../store/slices/departmentSlice';

function ChartSkeleton() {
  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl animate-pulse">
      <div className="w-40 h-4 rounded bg-slate-800 mb-2" />
      <div className="w-56 h-3 rounded bg-slate-800 mb-6" />
      <div className="h-64 rounded-xl bg-slate-800/60" />
    </div>
  );
}

export default function DepartmentAnalytics() {
  const dispatch = useDispatch();
  const { departments } = useSelector((state) => state.department);
  const {
    departmentStats,
    demographics,
    monthlyTrends,
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

  return (
    <div className="space-y-8">

          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest mb-1">
                <span>Analytics</span>
                <span>→</span>
                <span>Department Intelligence</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-100">Department Analytics</h1>
              <p className="text-sm text-slate-400 mt-1">
                Deep-dive workforce metrics, demographic distributions, and hiring trends per organizational unit.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all shrink-0"
            >
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
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

          {/* ── Department Cards ── */}
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

          {/* ── Demographic Charts ── */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-100">Demographic Distributions</h2>
              <p className="text-xs text-slate-400">Workforce composition across departments, gender, employment types, and tenure ranges</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading && !demographics?.byDepartment?.length ? (
                Array.from({ length: 6 }).map((_, i) => <ChartSkeleton key={i} />)
              ) : (
                <>
                  <EmployeesByDepartmentChart data={demographics?.byDepartment || []} />
                  <EmployeesByGenderChart data={demographics?.byGender || []} />
                  <EmployeesByEmploymentTypeChart data={demographics?.byEmploymentType || []} />
                </>
              )}
            </div>
          </section>

          {/* ── Trends Section ── */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-100">Monthly Workforce Trends</h2>
              <p className="text-xs text-slate-400">12-month hiring velocity and attrition benchmark timeline</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loading && !monthlyTrends?.length ? (
                <>
                  <ChartSkeleton />
                  <ChartSkeleton />
                </>
              ) : (
                <>
                  <MonthlyHiringTrendChart data={monthlyTrends || []} />
                  <MonthlyAttritionTrendChart data={monthlyTrends || []} />
                </>
              )}
            </div>
          </section>

          {/* ── Experience Distribution ── */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-100">Tenure & Experience Distribution</h2>
              <p className="text-xs text-slate-400">Workforce segmented by years of service</p>
            </div>
            {loading && !demographics?.experienceDistribution?.length ? (
              <ChartSkeleton />
            ) : (
              <ExperienceDistributionChart data={demographics?.experienceDistribution || []} />
            )}
          </section>

    </div>
  );
}
