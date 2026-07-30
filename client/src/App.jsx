import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import BaseLayout from './layouts/BaseLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import DepartmentAnalytics from './pages/DepartmentAnalytics';
import AiAnalytics from './pages/AiAnalytics';
import Departments from './pages/Departments';
import EmployeeProfile from './pages/EmployeeProfile';
import Employees from './pages/Employees';
import AttendancePage from './pages/AttendancePage';
import PerformancePage from './pages/PerformancePage';
import TrainingPage from './pages/TrainingPage';
import PromotionsPage from './pages/PromotionsPage';
import EmployeeVoicePage from './pages/EmployeeVoicePage';
import ReportsPage from './pages/ReportsPage';
import KnowledgeManagement from './pages/KnowledgeManagement';
import ManagerDashboard from './pages/ManagerDashboard';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import ResetPassword from './pages/ResetPassword';
import { injectStoreInApi } from './services/api';
import { store } from './store/store';
import { fetchCurrentUser } from './store/slices/authSlice';

// Inject Redux store into Axios interceptor
injectStoreInApi(store);

export default function App() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, accessToken]);

  return (
    <Routes>
      <Route element={<BaseLayout />}>
        {/* Public Routes */}
        <Route index element={<Home />} />
        <Route path="/login" element={<Login />} />
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
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
