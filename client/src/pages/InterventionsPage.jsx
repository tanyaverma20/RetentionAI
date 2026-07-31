import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { interventionService, approvalService, attachmentService } from '../services/workflowService';
import CommentThread from '../components/CommentThread';

const STATUS_STYLES = {
  DRAFT: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  APPROVED: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  ASSIGNED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  IN_PROGRESS: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  CANCELLED: 'bg-slate-600/10 text-slate-500 border-slate-600/30',
};

const NEXT_STATUS = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['CANCELLED'],
  APPROVED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

function CreateInterventionForm({ onCreated, onClose }) {
  const [form, setForm] = useState({ employeeId: '', title: '', description: '', priority: 'MEDIUM', dueDate: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await interventionService.create(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to create intervention.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-100 mb-4">New Intervention</h2>
        <div className="space-y-3">
          <input placeholder="Employee ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200" />
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200" rows={3} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200">
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200" />
        </div>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ id, onClose, onChanged }) {
  const { user } = useSelector((state) => state.auth);
  const [intervention, setIntervention] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await interventionService.get(id);
    setIntervention(data);
    const files = await attachmentService.list('INTERVENTION', id);
    setAttachments(files);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (status) => {
    setBusy(true);
    setError('');
    try {
      const extra = status === 'ASSIGNED' ? { assignedToUserId: assignUserId } : {};
      await interventionService.transition(id, status, extra);
      await load();
      onChanged();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Transition failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprovalDecision = async (decision) => {
    setBusy(true);
    setError('');
    try {
      await approvalService.decide(intervention.approval._id, decision, decision === 'REJECTED' ? 'Rejected via UI' : 'Approved via UI');
      await load();
      onChanged();
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Approval decision failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await attachmentService.upload('INTERVENTION', id, file);
    await load();
  };

  if (!intervention) return null;

  const currentLevel = intervention.approval?.chain?.find((c) => c.level === intervention.approval.currentLevel);
  const canDecideApproval = intervention.approval?.overallStatus === 'PENDING' && currentLevel?.role === user?.role;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded-full border ${STATUS_STYLES[intervention.status]}`}>{intervention.status}</span>
            <h2 className="text-lg font-bold text-slate-100 mt-2">{intervention.title}</h2>
            <p className="text-xs text-slate-500">{intervention.employeeId?.firstName} {intervention.employeeId?.lastName} · {intervention.priority} priority</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>

        {intervention.description && <p className="text-xs text-slate-400 mb-4">{intervention.description}</p>}
        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        {/* Transition actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(NEXT_STATUS[intervention.status] || []).map((s) => (
            <div key={s} className="flex gap-1 items-center">
              {s === 'ASSIGNED' && (
                <input placeholder="User ID" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="px-2 py-1.5 text-[10px] bg-slate-950 border border-slate-800 rounded-lg text-slate-200 w-32" />
              )}
              <button onClick={() => handleTransition(s)} disabled={busy} className="px-3 py-1.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
                Move to {s.replace('_', ' ')}
              </button>
            </div>
          ))}
        </div>

        {/* Approval chain */}
        {intervention.approval && (
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl mb-4">
            <h3 className="text-xs font-bold text-slate-300 mb-2">Approval Chain — {intervention.approval.overallStatus}</h3>
            <div className="space-y-1.5">
              {intervention.approval.chain.map((c) => (
                <div key={c.level} className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Level {c.level} · {c.role}</span>
                  <span className={c.decision === 'APPROVED' ? 'text-emerald-400' : c.decision === 'REJECTED' ? 'text-rose-400' : 'text-amber-400'}>{c.decision}</span>
                </div>
              ))}
            </div>
            {canDecideApproval && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleApprovalDecision('APPROVED')} disabled={busy} className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">Approve</button>
                <button onClick={() => handleApprovalDecision('REJECTED')} disabled={busy} className="px-3 py-1.5 text-[10px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg">Reject</button>
              </div>
            )}
          </div>
        )}

        {/* Status history / timeline */}
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-300 mb-2">Timeline</h3>
          <div className="space-y-1.5">
            {intervention.statusHistory.map((h, i) => (
              <div key={i} className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">{h.status}</span> — {new Date(h.changedAt).toLocaleString()} {h.note && `· ${h.note}`}
              </div>
            ))}
          </div>
        </div>

        {/* Attachments */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300">Attachments</h3>
            <label className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
              + Upload
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          {attachments.length === 0 && <p className="text-[11px] text-slate-500 italic">No attachments.</p>}
          {attachments.map((a) => (
            <div key={a._id} className="text-[11px] text-slate-400">{a.originalName} ({Math.round(a.sizeBytes / 1024)}KB)</div>
          ))}
        </div>

        {/* Comments */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 mb-2">Comments</h3>
          <CommentThread entityType="INTERVENTION" entityId={id} />
        </div>
      </div>
    </div>
  );
}

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState([]);
  const [filter, setFilter] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await interventionService.list(filter);
    setInterventions(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-100">Interventions</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">+ New Intervention</button>
      </div>

      <div className="flex gap-2">
        <select onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300">
          <option value="">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        {loading && <p className="text-xs text-slate-500 italic p-6 text-center">Loading...</p>}
        {!loading && interventions.length === 0 && <p className="text-xs text-slate-500 italic p-6 text-center">No interventions found.</p>}
        {interventions.map((iv) => (
          <button key={iv._id} onClick={() => setSelectedId(iv._id)} className="w-full text-left flex items-center justify-between px-5 py-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
            <div>
              <p className="text-sm font-semibold text-slate-200">{iv.title}</p>
              <p className="text-[11px] text-slate-500">{iv.employeeId?.firstName} {iv.employeeId?.lastName} · {iv.priority}</p>
            </div>
            <span className={`px-2 py-1 text-[10px] font-bold rounded-full border ${STATUS_STYLES[iv.status]}`}>{iv.status}</span>
          </button>
        ))}
      </div>

      {showCreate && <CreateInterventionForm onCreated={load} onClose={() => setShowCreate(false)} />}
      {selectedId && <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  );
}
