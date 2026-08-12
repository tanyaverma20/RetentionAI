import React, { Suspense, lazy, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import BaseLayout from './layouts/BaseLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { injectStoreInApi } from './services/api';
import { store } from './store/store';
import { fetchCurrentUser } from './store/slices/authSlice';

// Sprint 10, Part 8 (Performance) — route-based code splitting. These pages
// are only ever needed after login, so bundling them into the initial chunk
// (previously a single ~1.1MB/295KB-gzip bundle covering every page in the
// app) delayed first paint for every visitor, including the ~50% who only
// ever see the public marketing/login pages. Each route below now ships as
// its own chunk, fetched on navigation.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DepartmentAnalytics = lazy(() => import('./pages/DepartmentAnalytics'));
const AiAnalytics = lazy(() => import('./pages/AiAnalytics'));
const Departments = lazy(() => import('./pages/Departments'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const Employees = lazy(() => import('./pages/Employees'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'));
const EmployeeVoicePage = lazy(() => import('./pages/EmployeeVoicePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'));
const InterventionsPage = lazy(() => import('./pages/InterventionsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const HrOperationsDashboard = lazy(() => import('./pages/HrOperationsDashboard'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const KnowledgeManagement = lazy(() => import('./pages/KnowledgeManagement'));
const AiObservabilityPage = lazy(() => import('./pages/AiObservabilityPage'));
const AiGovernancePage = lazy(() => import('./pages/AiGovernancePage'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Inject Redux store into Axios interceptor
injectStoreInApi(store);

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, accessToken]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<BaseLayout />}>
          {/* Public Routes */}
          <Route index element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes — all wrapped in DashboardLayout (provides Sidebar + scrollable content) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics/departments" element={<DepartmentAnalytics />} />
              <Route path="/analytics/ai" element={<AiAnalytics />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/:id" element={<EmployeeProfile />} />
              <Route path="/hr/attendance" element={<AttendancePage />} />
              <Route path="/hr/performance" element={<PerformancePage />} />
              <Route path="/hr/training" element={<TrainingPage />} />
              <Route path="/hr/promotions" element={<PromotionsPage />} />
              <Route path="/hr/employee-voice" element={<EmployeeVoicePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/knowledge" element={<KnowledgeManagement />} />
              <Route path="/manager-dashboard" element={<ManagerDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_DIRECTOR', 'CHRO', 'CEO', 'EXECUTIVE', 'COMPLIANCE_OFFICER']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/executive" element={<ExecutiveDashboard />} />
                <Route path="/observability" element={<AiObservabilityPage />} />
                <Route path="/governance" element={<AiGovernancePage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_ANALYST', 'DEPARTMENT_MANAGER', 'HR_DIRECTOR', 'CHRO']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/workflow" element={<HrOperationsDashboard />} />
                <Route path="/interventions" element={<InterventionsPage />} />
                <Route path="/tasks" element={<TasksPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_DIRECTOR', 'CHRO']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/audit" element={<AuditLogPage />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
