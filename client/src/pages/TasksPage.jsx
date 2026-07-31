import React, { useCallback, useEffect, useState } from 'react';
import { taskService } from '../services/workflowService';
import CommentThread from '../components/CommentThread';

const STATUS_STYLES = {
  OPEN: 'bg-sky-50 text-sky-600 border-sky-100',
  IN_PROGRESS: 'bg-violet-50 text-violet-600 border-violet-100',
  COMPLETED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  CANCELLED: 'bg-slate-600/10 text-slate-400 border-slate-600/30',
  ESCALATED: 'bg-rose-50 text-rose-600 border-rose-100',
};

function CreateTaskForm({ onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', ownerUserId: '', dueDate: '' });
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      await taskService.create(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to create task.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md p-6 bg-white border border-slate-100 rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">New Task</h2>
        <div className="space-y-3">
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" rows={3} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800">
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <input placeholder="Owner User ID (optional)" value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
        </div>
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Cancel</button>
          <button onClick={submit} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Create</button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ id, onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [reassignId, setReassignId] = useState('');
  const [escalateId, setEscalateId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setTask(await taskService.get(id));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Action failed.');
    }
  };

  if (!task) return null;
  const closed = ['COMPLETED', 'CANCELLED'].includes(task.status);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white border-l border-slate-100 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded-full border ${STATUS_STYLES[task.status]}`}>{task.status}</span>
            <h2 className="text-lg font-bold text-slate-900 mt-2">{task.title}</h2>
            <p className="text-xs text-slate-400">{task.priority} priority · Owner: {task.ownerUserId?.name || 'Unassigned'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {task.description && <p className="text-xs text-slate-500 mb-4">{task.description}</p>}
        {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

        {!closed && (
          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input placeholder="Assign/Reassign User ID" value={reassignId} onChange={(e) => setReassignId(e.target.value)} className="flex-1 px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
              <button onClick={() => run(() => taskService.assign(id, reassignId))} className="px-3 py-1.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Assign</button>
            </div>
            <div className="flex gap-2">
              <input placeholder="Escalate to User ID" value={escalateId} onChange={(e) => setEscalateId(e.target.value)} className="flex-1 px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
              <button onClick={() => run(() => taskService.escalate(id, escalateId))} className="px-3 py-1.5 text-[10px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg">Escalate</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => run(() => taskService.complete(id))} className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">Complete</button>
              <button onClick={() => run(() => taskService.cancel(id))} className="px-3 py-1.5 text-[10px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-600 mb-2">History</h3>
          <div className="space-y-1.5">
            {task.history.map((h, i) => (
              <div key={i} className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">{h.action}</span> — {new Date(h.at).toLocaleString()} {h.note && `· ${h.note}`}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-600 mb-2">Comments</h3>
          <CommentThread entityType="TASK" entityId={id} />
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setTasks(await taskService.list(filter));
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Tasks</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">+ New Task</button>
      </div>

      <div className="flex gap-2">
        <select onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
          <option value="">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
        {loading && <p className="text-xs text-slate-400 italic p-6 text-center">Loading...</p>}
        {!loading && tasks.length === 0 && <p className="text-xs text-slate-400 italic p-6 text-center">No tasks found.</p>}
        {tasks.map((t) => (
          <button key={t._id} onClick={() => setSelectedId(t._id)} className="w-full text-left flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-100/50">
            <div>
              <p className="text-sm font-semibold text-slate-800">{t.title}</p>
              <p className="text-[11px] text-slate-400">{t.priority} · Owner: {t.ownerUserId?.name || 'Unassigned'} {t.dueDate && `· Due ${new Date(t.dueDate).toLocaleDateString()}`}</p>
            </div>
            <span className={`px-2 py-1 text-[10px] font-bold rounded-full border ${STATUS_STYLES[t.status]}`}>{t.status}</span>
          </button>
        ))}
      </div>

      {showCreate && <CreateTaskForm onCreated={load} onClose={() => setShowCreate(false)} />}
      {selectedId && <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  );
}
