import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../services/workflowService';

const SEVERITY_DOT = {
  CRITICAL: 'bg-rose-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-slate-400',
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
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-card z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">Notifications</span>
            <button onClick={async () => { await notificationService.markAllRead(); await load(); }} className="text-[10px] text-indigo-600 hover:text-indigo-500">
              Mark all read
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {notifications.length === 0 && <p className="text-xs text-slate-400 italic p-4 text-center">No notifications.</p>}
            {notifications.map((n) => (
              <div key={n._id} className={`p-3 ${!n.isRead ? 'bg-indigo-50/60' : ''}`}>
                <div className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[n.severity] || 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                    {n.message && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    <div className="flex gap-2 mt-1.5">
                      {!n.isRead && <button onClick={() => handleAction(n._id, 'read')} className="text-[10px] text-indigo-600 hover:text-indigo-500">Mark read</button>}
                      <button onClick={() => handleAction(n._id, 'archive')} className="text-[10px] text-slate-400 hover:text-slate-600">Archive</button>
                      <button onClick={() => handleAction(n._id, 'dismiss')} className="text-[10px] text-slate-400 hover:text-slate-600">Dismiss</button>
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
