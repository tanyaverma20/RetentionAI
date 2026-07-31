import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';

/** Routes that use the full-height sidebar layout */
const DASHBOARD_PATHS = ['/dashboard', '/analytics', '/departments', '/employees'];

export default function BaseLayout() {
  const location = useLocation();
  const useDashboardLayout = DASHBOARD_PATHS.some((p) => location.pathname.startsWith(p));

  if (useDashboardLayout) {
    return (
      <div className="h-screen bg-canvas text-slate-900 flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-hidden">
        <Navbar />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-slate-900 flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white/50 py-6 text-center text-xs text-slate-400">
        RetentionAI Platform &copy; 2026 &bull; Secure Authentication &amp; Authorization Engine
      </footer>
    </div>
  );
}
