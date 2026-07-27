import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

/**
 * DashboardLayout wraps all authenticated dashboard pages with a persistent
 * left Sidebar and a scrollable main content area. The top Navbar from
 * BaseLayout is rendered above this via the route hierarchy in App.jsx.
 */
export default function DashboardLayout() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
