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
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'HR_MANAGER':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'DEPARTMENT_MANAGER':
      case 'DEPT_MANAGER':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/90 border-b border-slate-800 shrink-0">
      <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* ── Left: Logo (hidden on dashboard since sidebar shows it) ── */}
        {!isDashboard && (
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              R
            </div>
            <span className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200 hidden sm:block">
              RetentionAI
            </span>
          </Link>
        )}

        {/* ── Dashboard breadcrumb / system status ── */}
        {isDashboard && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">Live</span>
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
                  <Link to="/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/departments" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Departments
                  </Link>
                  <Link to="/employees" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
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

              <div className="h-4 w-px bg-slate-800 hidden sm:block" />

              {/* User identity */}
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-500 leading-tight truncate max-w-[140px]">{user.email}</div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow">
                  {(user.name || 'U')[0]}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold border hidden sm:inline ${getRoleBadgeStyle(user.role)}`}>
                  {user.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/20 transition-all"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

