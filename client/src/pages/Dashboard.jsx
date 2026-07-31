import React, { useCallback, useEffect, useState } from 'react';
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
  PerformanceDistributionChart,
  AgeDistributionChart,
  LeaveStatisticsChart,
  AdvancedTrendsChart,
  GlobalFeatureImportanceChart,
  SentimentDistributionChart,
  BurnoutDistributionChart,
  EmotionDistributionChart,
  TopicFrequencyChart,
  SentimentBurnoutTrendChart,
  RecommendationDistributionChart,
  RecommendationTrendsChart,
  RECOMMENDATION_TYPE_LABELS,
} from '../components/analytics/AnalyticsCharts';
import DepartmentAnalyticsTable from '../components/analytics/DepartmentAnalyticsTable';
import EmployeeInsightsCard from '../components/analytics/EmployeeInsightsCard';
import AnalyticsFilterBar from '../components/analytics/AnalyticsFilterBar';

import { fetchDashboardSummary, setAnalyticsFilter, resetAnalyticsFilters } from '../store/slices/analyticsSlice';
import { fetchDepartments } from '../store/slices/departmentSlice';
import { aiService } from '../services/aiService';
import { knowledgeService } from '../services/knowledgeService';
import { decisionService } from '../services/decisionService';

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
function LogoutIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
    advancedCharts,
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

  // AI risk counts, top high risk, and global feature importance
  const [riskCounts, setRiskCounts] = useState(null);
  const [topHighRisk, setTopHighRisk] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState('');
  const [globalImportance, setGlobalImportance] = useState(null);
  const [departmentDrivers, setDepartmentDrivers] = useState(null);
  const [aiOverviewError, setAiOverviewError] = useState('');
  const [isGeneratingExplanations, setIsGeneratingExplanations] = useState(false);
  const [explainMessage, setExplainMessage] = useState('');
  const [intelligenceStats, setIntelligenceStats] = useState(null);
  const [intelligenceError, setIntelligenceError] = useState('');
  const [isGeneratingIntelligence, setIsGeneratingIntelligence] = useState(false);
  const [intelligenceMessage, setIntelligenceMessage] = useState('');
  const [knowledgeStats, setKnowledgeStats] = useState(null);
  const [knowledgeStatsError, setKnowledgeStatsError] = useState('');
  const [decisionStats, setDecisionStats] = useState(null);
  const [decisionStatsError, setDecisionStatsError] = useState('');
  const [isGeneratingDecisions, setIsGeneratingDecisions] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState('');

  const extractErrorMessage = (err, fallback) =>
    err?.response?.data?.error?.message || err?.message || fallback;

  const loadExplainabilityWidgets = useCallback(() => {
    aiService.getDashboardAnalytics()
      .then(data => {
        setRiskCounts(data?.riskCounts);
        setTopHighRisk(data?.topHighRisk);
      })
      .catch((err) => setAiOverviewError(extractErrorMessage(err, 'Unable to load AI risk overview.')));
    aiService.getGlobalFeatureImportance()
      .then(data => setGlobalImportance(data?.features || data))
      .catch(() => {}); // Expected until a model has been trained — no model = no chart, not an error state.
    aiService.getDepartmentRiskDrivers()
      .then(setDepartmentDrivers)
      .catch(() => {}); // Expected until explanations have been generated at least once.
    aiService.getEmployeeIntelligenceDashboard()
      .then((data) => { setIntelligenceStats(data); setIntelligenceError(''); })
      .catch((err) => setIntelligenceError(extractErrorMessage(err, 'Unable to load Employee Intelligence overview.')));
    knowledgeService.getStatistics()
      .then((data) => { setKnowledgeStats(data); setKnowledgeStatsError(''); })
      .catch((err) => setKnowledgeStatsError(extractErrorMessage(err, 'Unable to load Knowledge Base statistics.')));
    decisionService.getDashboardSummary()
      .then((data) => { setDecisionStats(data); setDecisionStatsError(''); })
      .catch((err) => setDecisionStatsError(extractErrorMessage(err, 'Unable to load AI Recommendations overview.')));
  }, []);

  useEffect(() => {
    loadExplainabilityWidgets();
  }, [loadExplainabilityWidgets]);

  const handleTrainModel = async () => {
    try {
      setIsTraining(true);
      setTrainMessage('');

      // /ai/train only acknowledges that training has been scheduled in the
      // AI service's background — it returns immediately, long before the
      // model is actually retrained. Capture the current model's trainedAt
      // first so we can tell a genuinely new model apart from the one
      // already running, instead of just echoing the "started" ack forever.
      let baselineTrainedAt = null;
      try {
        const info = await aiService.getModelInfo();
        baselineTrainedAt = info?.trainedAt ?? null;
      } catch {
        // No model loaded yet — any successful getModelInfo() below counts as new.
      }

      const res = await aiService.trainModel();
      setTrainMessage(res?.message || 'Training started.');

      const POLL_INTERVAL_MS = 5000;
      const MAX_POLLS = 60; // 5 minutes
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const info = await aiService.getModelInfo();
          if (info?.trainedAt && info.trainedAt !== baselineTrainedAt) {
            setTrainMessage(`Model trained successfully — ${info.algorithm} (${info.version}).`);
            loadExplainabilityWidgets();
            return;
          }
        } catch {
          // Model not loaded yet — still training, keep polling.
        }
      }
      setTrainMessage('Training is taking longer than expected — it may still be running in the background. Check back shortly.');
    } catch (err) {
      setTrainMessage(extractErrorMessage(err, 'Failed to start training.'));
    } finally {
      setIsTraining(false);
    }
  };

  const handleGenerateExplanations = async () => {
    try {
      setIsGeneratingExplanations(true);
      setExplainMessage('');
      const res = await aiService.explainBatch();
      setExplainMessage(`Generated explanations for ${res?.processed ?? 0} employees.`);
      loadExplainabilityWidgets();
    } catch (err) {
      setExplainMessage(extractErrorMessage(err, 'Failed to generate explanations.'));
    } finally {
      setIsGeneratingExplanations(false);
    }
  };

  const handleGenerateIntelligenceBatch = async () => {
    try {
      setIsGeneratingIntelligence(true);
      setIntelligenceMessage('');
      const res = await aiService.generateEmployeeIntelligenceBatch();
      setIntelligenceMessage(`Analyzed ${res?.processed ?? 0} employees.`);
      loadExplainabilityWidgets();
    } catch (err) {
      setIntelligenceMessage(extractErrorMessage(err, 'Failed to generate Employee Intelligence.'));
    } finally {
      setIsGeneratingIntelligence(false);
    }
  };

  const handleGenerateDecisionsBatch = async () => {
    try {
      setIsGeneratingDecisions(true);
      setDecisionMessage('');
      const res = await decisionService.generateBatch();
      setDecisionMessage(`Generated ${res?.processed ?? 0} recommendation(s).`);
      decisionService.getDashboardSummary()
        .then((data) => { setDecisionStats(data); setDecisionStatsError(''); })
        .catch((err) => setDecisionStatsError(extractErrorMessage(err, 'Unable to load AI Recommendations overview.')));
    } catch (err) {
      setDecisionMessage(extractErrorMessage(err, 'Failed to generate recommendations.'));
    } finally {
      setIsGeneratingDecisions(false);
    }
  };

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
                  Here&apos;s your workforce intelligence overview for RetentionAI.
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
                  <KpiCard title="Employees on Leave" value={kpis?.employeesOnLeave} color="rose" icon={<LogoutIcon />} label="Currently on approved leave" />
                  <KpiCard title="Avg Satisfaction" value={kpis?.avgSatisfaction} unit="/ 5" color="emerald" icon={<SmileIcon />} label="Average job satisfaction" />
                  <KpiCard title="Total Feedback" value={kpis?.totalFeedback} color="violet" icon={<MailIcon />} label="Employee feedback submitted" />
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
                    <AdvancedTrendsChart data={advancedCharts?.advancedTrends || []} />
                  </div>
                  <PerformanceDistributionChart data={advancedCharts?.performanceDistribution || []} />
                  <ExperienceDistributionChart data={demographics?.experienceDistribution || []} />
                  <AgeDistributionChart data={demographics?.ageDistribution || []} />
                  <LeaveStatisticsChart data={advancedCharts?.leaveStatistics || []} />
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

          {/* ── AI Attrition Risk ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">🧠 AI Attrition Risk Overview</h2>
                <p className="text-xs text-slate-400">ML-predicted risk distribution across your workforce</p>
              </div>
              <div className="flex items-center gap-3">
                {trainMessage && <span className="text-xs text-indigo-400">{trainMessage}</span>}
                <button
                  onClick={handleTrainModel}
                  disabled={isTraining}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
                >
                  {isTraining ? 'Training...' : 'Train Model'}
                </button>
              </div>
            </div>

            {aiOverviewError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">
                {aiOverviewError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'High Risk', count: riskCounts?.HIGH ?? '–', color: 'rose', desc: 'Likely to leave soon' },
                { label: 'Medium Risk', count: riskCounts?.MEDIUM ?? '–', color: 'amber', desc: 'Monitor closely' },
                { label: 'Low Risk', count: riskCounts?.LOW ?? '–', color: 'emerald', desc: 'Stable & engaged' },
              ].map(({ label, count, color, desc }) => (
                <div key={label} className={`p-5 bg-slate-900 border border-${color}-500/20 rounded-3xl flex items-center gap-4 shadow-xl`}>
                  <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 flex items-center justify-center text-2xl font-black text-${color}-400`}>
                    {count}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {(!riskCounts) && (
              <div className="text-center py-6 text-xs text-slate-500 italic">
                No predictions available yet. Run <strong>&quot;Run AI Prediction&quot;</strong> on the Employees page to generate risk scores.
              </div>
            )}

            {/* Top 10 High Risk Employees Table */}
            {topHighRisk && topHighRisk.length > 0 && (
              <div className="mt-6 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                <h3 className="text-md font-bold text-slate-200 mb-4">Top 10 High Risk Employees</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4 font-semibold">Employee</th>
                        <th className="py-3 px-4 font-semibold">Department</th>
                        <th className="py-3 px-4 font-semibold">Risk Score</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {topHighRisk.map((prediction) => {
                        const emp = prediction.employeeId;
                        if (!emp) return null;
                        return (
                          <tr key={prediction._id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                            <td className="py-3 px-4">
                              <Link to={`/employees/${emp._id}`} className="flex items-center gap-3 group">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                  {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                                    {emp.firstName} {emp.lastName}
                                  </div>
                                  <div className="text-xs text-slate-500">{emp.designation}</div>
                                </div>
                              </Link>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {emp.departmentId?.name || 'Unknown'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                {(prediction.riskScore * 100).toFixed(0)}%
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── Explainability (SHAP) ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">⚖️ Explainability</h2>
                <p className="text-xs text-slate-400">Why the model predicts what it predicts, workforce-wide</p>
              </div>
              <div className="flex items-center gap-3">
                {explainMessage && <span className="text-xs text-amber-400">{explainMessage}</span>}
                <button
                  onClick={handleGenerateExplanations}
                  disabled={isGeneratingExplanations}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
                >
                  {isGeneratingExplanations ? 'Generating…' : 'Generate Explanations'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {globalImportance?.length > 0 ? (
                <GlobalFeatureImportanceChart data={globalImportance} />
              ) : (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex items-center justify-center text-center text-xs text-slate-500 italic h-full min-h-[16rem]">
                  No global feature importance yet. Train a model first, then reload this page.
                </div>
              )}

              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-100">Department Risk Drivers</h3>
                  <p className="text-xs text-slate-400">Top attrition-risk factor per department, from generated explanations</p>
                </div>
                {departmentDrivers?.length > 0 ? (
                  <div className="space-y-2">
                    {departmentDrivers.map((d) => (
                      <div key={d.departmentId || d.departmentName} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{d.departmentName}</div>
                          <div className="text-xs text-slate-500">{d.sampleSize} explanation(s) sampled</div>
                        </div>
                        <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                          {d.topFeature}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-500 italic py-8">
                    No department drivers yet — click <strong>&quot;Generate Explanations&quot;</strong> above to populate this from the current workforce.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Employee Intelligence (NLP) ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">🎭 Employee Intelligence</h2>
                <p className="text-xs text-slate-400">How the workforce feels — sentiment, emotion, burnout, and concerns from feedback, surveys, and manager notes</p>
              </div>
              <div className="flex items-center gap-3">
                {intelligenceMessage && <span className="text-xs text-violet-400">{intelligenceMessage}</span>}
                <button
                  onClick={handleGenerateIntelligenceBatch}
                  disabled={isGeneratingIntelligence}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
                >
                  {isGeneratingIntelligence ? 'Analyzing…' : 'Generate Employee Intelligence'}
                </button>
              </div>
            </div>

            {intelligenceError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">
                {intelligenceError}
              </div>
            )}

            {intelligenceStats && intelligenceStats.totalEmployeesAnalyzed === 0 ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center text-xs text-slate-500 italic">
                No Employee Intelligence profiles generated yet. Open an employee&apos;s profile and click <strong>&quot;Analyze Employee Sentiment&quot;</strong> to populate these widgets.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <SentimentDistributionChart data={intelligenceStats?.sentimentDistribution || {}} />
                <BurnoutDistributionChart data={intelligenceStats?.burnoutDistribution || {}} />
                <EmotionDistributionChart data={intelligenceStats?.emotionDistribution || {}} />
                <TopicFrequencyChart
                  data={intelligenceStats?.topConcerns || []}
                  title="Top Employee Concerns"
                  subtitle="Most frequently mentioned topics workforce-wide"
                />
                <TopicFrequencyChart
                  data={intelligenceStats?.topConcerns || []}
                  title="Trending Topics"
                  subtitle="What's coming up most often right now"
                />
                <div className="md:col-span-2 xl:col-span-1">
                  <SentimentBurnoutTrendChart data={intelligenceStats?.trendOverTime || []} />
                </div>

                {/* Department Sentiment */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl md:col-span-2 xl:col-span-1">
                  <h3 className="text-base font-bold text-slate-100 mb-4">Department Sentiment</h3>
                  <div className="space-y-2">
                    {(intelligenceStats?.departmentBreakdown || []).map((d) => (
                      <div key={String(d.departmentId || d.departmentName)} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                        <span className="font-semibold text-slate-200">{d.departmentName}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-emerald-400">+{d.sentimentCounts.Positive}</span>
                          <span className="text-slate-500">•{d.sentimentCounts.Neutral}</span>
                          <span className="text-rose-400">-{d.sentimentCounts.Negative}</span>
                        </div>
                      </div>
                    ))}
                    {!(intelligenceStats?.departmentBreakdown?.length) && (
                      <p className="text-center text-xs text-slate-500 italic py-6">No data yet.</p>
                    )}
                  </div>
                </div>

                {/* Department Burnout */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                  <h3 className="text-base font-bold text-slate-100 mb-4">Department Burnout</h3>
                  <div className="space-y-2">
                    {(intelligenceStats?.departmentBreakdown || []).map((d) => (
                      <div key={String(d.departmentId || d.departmentName)} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                        <span className="font-semibold text-slate-200">{d.departmentName}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-emerald-400">L:{d.burnoutCounts.Low}</span>
                          <span className="text-amber-400">M:{d.burnoutCounts.Medium}</span>
                          <span className="text-rose-400">H:{d.burnoutCounts.High}</span>
                        </div>
                      </div>
                    ))}
                    {!(intelligenceStats?.departmentBreakdown?.length) && (
                      <p className="text-center text-xs text-slate-500 italic py-6">No data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Knowledge Base Statistics (RAG) ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">📚 Knowledge Base</h2>
                <p className="text-xs text-slate-400">What organizational knowledge is indexed and how it&apos;s being used</p>
              </div>
              <Link to="/knowledge" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                Manage Knowledge Base →
              </Link>
            </div>

            {knowledgeStatsError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">
                {knowledgeStatsError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <KpiCard
                title="Documents Indexed"
                value={knowledgeStats?.documentsIndexedCount ?? 0}
                color="sky"
                icon={<AcademicCapIcon />}
                label="Policies, handbooks & SOPs"
              />
              <KpiCard
                title="Indexed Chunks"
                value={knowledgeStats?.totalChunks ?? 0}
                color="indigo"
                icon={<ChartIcon />}
                label="Vector-store passages"
              />
              <KpiCard
                title="Queries (recent)"
                value={knowledgeStats?.recentQueryCount ?? 0}
                color="violet"
                icon={<SparklesIcon />}
                label="Knowledge lookups logged"
              />
              <KpiCard
                title="Query Success Rate"
                value={knowledgeStats?.querySuccessRate != null ? Math.round(knowledgeStats.querySuccessRate * 100) : 0}
                unit="%"
                color="emerald"
                icon={<UserCheckIcon />}
                label="Grounded (non-fallback) answers"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                <h3 className="text-base font-bold text-slate-100 mb-4">Most Queried Policies</h3>
                {knowledgeStats?.mostSearchedPolicies?.length > 0 ? (
                  <div className="space-y-2">
                    {knowledgeStats.mostSearchedPolicies.map((name, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-sm">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-slate-200">{name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500 italic py-8">No queries logged yet.</p>
                )}
              </div>

              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                <h3 className="text-base font-bold text-slate-100 mb-4">Recent Uploads</h3>
                {knowledgeStats?.recentUploads?.length > 0 ? (
                  <div className="space-y-2">
                    {knowledgeStats.recentUploads.map((doc) => (
                      <div key={doc._id} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                        <div>
                          <div className="font-semibold text-slate-200">{doc.filename}</div>
                          <div className="text-slate-500">{doc.documentType?.replace(/_/g, ' ')} • {doc.uploadedBy?.name || 'Unknown'}</div>
                        </div>
                        <span className="font-mono text-slate-500">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500 italic py-8">No documents uploaded yet.</p>
                )}
              </div>
            </div>
          </section>

          {/* ── AI Recommendations (Decision Intelligence) ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">🎯 AI Recommendations</h2>
                <p className="text-xs text-slate-400">What HR should do next — combining prediction, SHAP, sentiment, and policy evidence</p>
              </div>
              <div className="flex items-center gap-3">
                {decisionMessage && <span className="text-xs text-fuchsia-400">{decisionMessage}</span>}
                <button
                  onClick={handleGenerateDecisionsBatch}
                  disabled={isGeneratingDecisions}
                  className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
                >
                  {isGeneratingDecisions ? 'Generating…' : 'Generate Recommendations'}
                </button>
              </div>
            </div>

            {decisionStatsError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{decisionStatsError}</div>
            )}

            {decisionStats && decisionStats.totalEmployeesWithDecisions === 0 ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center text-xs text-slate-500 italic">
                No recommendations generated yet. Click &quot;Generate Recommendations&quot; above to populate this from the current workforce.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Employees with Recommendations</div>
                    <div className="text-2xl font-black text-slate-100">{decisionStats?.totalEmployeesWithDecisions ?? 0}</div>
                  </div>
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Recommendation Acceptance Rate</div>
                    <div className="text-2xl font-black text-emerald-400">
                      {decisionStats?.acceptanceRate != null ? `${Math.round(decisionStats.acceptanceRate * 100)}%` : '—'}
                    </div>
                  </div>
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">HR Action Queue</div>
                    <div className="text-2xl font-black text-amber-400">{decisionStats?.hrActionQueue?.length ?? 0}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <RecommendationDistributionChart data={decisionStats?.recommendationDistribution || {}} />
                  <RecommendationTrendsChart data={decisionStats?.recommendationTrends || []} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Critical Employees */}
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                    <h3 className="text-base font-bold text-slate-100 mb-4">Critical Employees</h3>
                    <div className="space-y-2">
                      {(decisionStats?.criticalEmployees || []).length === 0 && (
                        <p className="text-center text-xs text-slate-500 italic py-6">No critical (high-priority) employees right now.</p>
                      )}
                      {(decisionStats?.criticalEmployees || []).map((e) => (
                        <Link key={e.employeeId} to={`/employees/${e.employeeId}`} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 hover:border-fuchsia-500/30 rounded-xl text-xs transition-colors">
                          <div>
                            <div className="font-semibold text-slate-200">{e.employeeName}</div>
                            <div className="text-slate-500">{e.departmentName} • {RECOMMENDATION_TYPE_LABELS[e.recommendationType] || e.recommendationType}</div>
                          </div>
                          <span className="font-mono text-rose-400">{((e.confidence || 0) * 100).toFixed(0)}%</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* High Priority Actions */}
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                    <h3 className="text-base font-bold text-slate-100 mb-4">High Priority Actions</h3>
                    <div className="space-y-2">
                      {(decisionStats?.highPriorityActions || []).length === 0 && (
                        <p className="text-center text-xs text-slate-500 italic py-6">No pending high-priority actions.</p>
                      )}
                      {(decisionStats?.highPriorityActions || []).map((e) => (
                        <Link key={e.decisionId} to={`/employees/${e.employeeId}`} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 hover:border-fuchsia-500/30 rounded-xl text-xs transition-colors">
                          <span className="font-semibold text-slate-200">{e.employeeName}</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase">{RECOMMENDATION_TYPE_LABELS[e.recommendationType] || e.recommendationType}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Department Recommendations */}
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                    <h3 className="text-base font-bold text-slate-100 mb-4">Department Recommendations</h3>
                    <div className="space-y-2">
                      {(decisionStats?.departmentBreakdown || []).map((d) => (
                        <div key={String(d.departmentId || d.departmentName)} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                          <span className="font-semibold text-slate-200">{d.departmentName}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-rose-400">H:{d.high}</span>
                            <span className="text-amber-400">M:{d.medium}</span>
                            <span className="text-emerald-400">L:{d.low}</span>
                          </div>
                        </div>
                      ))}
                      {!(decisionStats?.departmentBreakdown?.length) && (
                        <p className="text-center text-xs text-slate-500 italic py-6">No data yet.</p>
                      )}
                    </div>
                  </div>

                  {/* HR Action Queue */}
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                    <h3 className="text-base font-bold text-slate-100 mb-4">HR Action Queue</h3>
                    <div className="space-y-2">
                      {(decisionStats?.hrActionQueue || []).length === 0 && (
                        <p className="text-center text-xs text-slate-500 italic py-6">Queue is empty — no pending decisions.</p>
                      )}
                      {(decisionStats?.hrActionQueue || []).map((q) => (
                        <Link key={q.decisionId} to={`/employees/${q.employeeId}`} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 hover:border-fuchsia-500/30 rounded-xl text-xs transition-colors">
                          <span className="font-semibold text-slate-200">{q.employeeName}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${q.priority === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : q.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {RECOMMENDATION_TYPE_LABELS[q.recommendationType] || q.recommendationType}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Decision History */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
                  <h3 className="text-base font-bold text-slate-100 mb-4">Decision History</h3>
                  <div className="space-y-2">
                    {(decisionStats?.decisionHistory || []).length === 0 && (
                      <p className="text-center text-xs text-slate-500 italic py-6">No decisions generated yet.</p>
                    )}
                    {(decisionStats?.decisionHistory || []).map((d) => (
                      <div key={d._id} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs">
                        <div>
                          <span className="font-semibold text-slate-200">{d.employeeId?.firstName} {d.employeeId?.lastName}</span>
                          <span className="text-slate-500 ml-2">{RECOMMENDATION_TYPE_LABELS[d.recommendationType] || d.recommendationType}</span>
                        </div>
                        <span className="font-mono text-slate-500">{new Date(d.generatedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
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
