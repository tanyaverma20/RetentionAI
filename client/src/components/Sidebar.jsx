import React from 'react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Sparkles,
  Users,
  Building2,
  CalendarClock,
  Award,
  GraduationCap,
  TrendingUp,
  MessageSquare,
  FileText,
  BookOpen,
  Workflow,
  Zap,
  CheckSquare,
  ShieldCheck,
  Building,
} from 'lucide-react';

const EXECUTIVE_ROLES = ['ADMIN', 'HR_DIRECTOR', 'CHRO', 'CEO'];
const WORKFLOW_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_ANALYST', 'DEPARTMENT_MANAGER', 'HR_DIRECTOR', 'CHRO'];
const AUDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_DIRECTOR', 'CHRO'];

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/analytics/departments', icon: BarChart3, label: 'Analytics' },
      { to: '/analytics/ai', icon: Sparkles, label: 'AI Insights' },
      { to: '/manager-dashboard', icon: TrendingUp, label: 'Manager Dashboard' },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { to: '/departments', icon: Building2, label: 'Departments' },
      { to: '/employees', icon: Users, label: 'Employees' },
    ],
  },
  {
    label: 'HR Operations',
    items: [
      { to: '/hr/attendance', icon: CalendarClock, label: 'Attendance' },
      { to: '/hr/performance', icon: Award, label: 'Performance' },
      { to: '/hr/training', icon: GraduationCap, label: 'Training' },
      { to: '/hr/promotions', icon: TrendingUp, label: 'Promotions' },
      { to: '/hr/employee-voice', icon: MessageSquare, label: 'Employee Voice' },
      { to: '/reports', icon: FileText, label: 'Reports' },
      { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const groups = [...navGroups];

  if (WORKFLOW_ROLES.includes(user?.role)) {
    groups.push({
      label: 'Workflow',
      items: [
        { to: '/workflow', icon: Workflow, label: 'HR Operations' },
        { to: '/interventions', icon: Zap, label: 'Interventions' },
        { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
      ],
    });
  }

  if (AUDIT_ROLES.includes(user?.role)) {
    groups.push({
      label: 'Compliance',
      items: [{ to: '/audit', icon: ShieldCheck, label: 'Audit Log' }],
    });
  }

  if (EXECUTIVE_ROLES.includes(user?.role)) {
    groups.push({
      label: 'Executive',
      items: [{ to: '/executive', icon: Building, label: 'Executive Center' }],
    });
  }

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col bg-white border-r border-slate-100 h-full">
      {/* Branding */}
      <div className="px-6 py-5 border-b border-slate-100">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-soft">
            R
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900">RetentionAI</span>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Platform v1.0</p>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      active
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer  */}
      <div className="px-4 py-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 font-medium text-center">© 2026 RetentionAI</p>
      </div>
    </aside>
  );
}
