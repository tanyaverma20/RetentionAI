import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logoutUser } from '../store/slices/authSlice';
import NotificationBell from './NotificationBell';
import GlobalSearchBar from './GlobalSearchBar';

const DASHBOARD_PATHS = ['/dashboard', '/analytics', '/departments', '/employees'];

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const isDashboard = DASHBOARD_PATHS.some((p) => location.pathname.startsWith(p));

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-violet-50 text-violet-600 border-violet-100';
      case 'HR_MANAGER':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'DEPARTMENT_MANAGER':
      case 'DEPT_MANAGER':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-100 shrink-0">
      <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* ── Left: Logo (hidden on dashboard since sidebar shows it) ── */}
        {!isDashboard && (
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-soft group-hover:scale-105 transition-transform duration-200">
              R
            </div>
            <span className="text-lg font-extrabold text-slate-900 hidden sm:block">
              RetentionAI
            </span>
          </Link>
        )}

        {/* ── Dashboard breadcrumb / system status ── */}
        {isDashboard && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 font-semibold">Live</span>
            </div>
            <span>·</span>
            <span>RetentionAI Analytics Engine</span>
          </div>
        )}

        {/* ── Right: Auth context ── */}
        <nav className="flex items-center gap-3 ml-auto">
          {isAuthenticated && user ? (
            <>
              {/* Quick navigation links — only shown when NOT in dashboard (sidebar handles those) */}
              {!isDashboard && (
                <div className="hidden sm:flex items-center gap-4 mr-2">
                  <Link to="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/departments" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Departments
                  </Link>
                  <Link to="/employees" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Employees
                  </Link>
                </div>
              )}

              {isDashboard && (
                <div className="hidden md:block w-56">
                  <GlobalSearchBar />
                </div>
              )}

              <NotificationBell />

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              {/* User identity */}
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[140px]">{user.email}</div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-soft">
                  {(user.name || 'U')[0]}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border hidden sm:inline ${getRoleBadgeStyle(user.role)}`}>
                  {user.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-soft transition-all"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
