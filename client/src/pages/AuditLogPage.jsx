import React, { useCallback, useEffect, useState } from 'react';
import { auditService } from '../services/workflowService';

export default function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setEntries(await auditService.list(filter));
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Audit Log</h1>
        <button onClick={() => auditService.downloadCsv(filter)} className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl">
          📊 Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input placeholder="Action (e.g. TASK_CREATED)" onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600 w-56" />
        <input placeholder="Entity Type" onChange={(e) => setFilter((f) => ({ ...f, entityType: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600 w-40" />
        <input type="date" onChange={(e) => setFilter((f) => ({ ...f, startDate: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600" />
        <input type="date" onChange={(e) => setFilter((f) => ({ ...f, endDate: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600" />
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-widest">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Entity</th>
                <th className="text-left px-4 py-3">Changes</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center py-6 text-slate-400 italic">Loading...</td></tr>}
              {!loading && entries.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400 italic">No audit entries found.</td></tr>}
              {entries.map((e) => (
                <tr key={e._id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-slate-500">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{e.action}</td>
                  <td className="px-4 py-2.5 text-slate-500">{e.userId?.name || 'System'}</td>
                  <td className="px-4 py-2.5 text-slate-400">{e.entityType || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-400 max-w-xs truncate">
                    {e.changes?.old !== undefined ? `${JSON.stringify(e.changes.old)} → ${JSON.stringify(e.changes.new)}` : JSON.stringify(e.context || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
