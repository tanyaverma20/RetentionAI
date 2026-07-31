import React, { useCallback, useEffect, useRef, useState } from 'react';
import { notificationService } from '../services/workflowService';

const SEVERITY_DOT = {
  CRITICAL: 'bg-rose-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-slate-500',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const result = await notificationService.list({ limit: 20 });
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // notification polling failures shouldn't disrupt the rest of the UI
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = async (id, action) => {
    if (action === 'read') await notificationService.markRead(id);
    else if (action === 'archive') await notificationService.archive(id);
    else if (action === 'dismiss') await notificationService.dismiss(id);
    await load();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-bold text-slate-100">Notifications</span>
            <button onClick={async () => { await notificationService.markAllRead(); await load(); }} className="text-[10px] text-indigo-400 hover:text-indigo-300">
              Mark all read
            </button>
          </div>
          <div className="divide-y divide-slate-800">
            {notifications.length === 0 && <p className="text-xs text-slate-500 italic p-4 text-center">No notifications.</p>}
            {notifications.map((n) => (
              <div key={n._id} className={`p-3 ${!n.isRead ? 'bg-indigo-500/5' : ''}`}>
                <div className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[n.severity] || 'bg-slate-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200">{n.title}</p>
                    {n.message && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    <div className="flex gap-2 mt-1.5">
                      {!n.isRead && <button onClick={() => handleAction(n._id, 'read')} className="text-[10px] text-indigo-400 hover:text-indigo-300">Mark read</button>}
                      <button onClick={() => handleAction(n._id, 'archive')} className="text-[10px] text-slate-500 hover:text-slate-300">Archive</button>
                      <button onClick={() => handleAction(n._id, 'dismiss')} className="text-[10px] text-slate-500 hover:text-slate-300">Dismiss</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
