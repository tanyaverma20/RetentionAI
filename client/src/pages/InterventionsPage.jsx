import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { interventionService, approvalService, attachmentService } from '../services/workflowService';
import CommentThread from '../components/CommentThread';

const STATUS_STYLES = {
  PROPOSED: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  DRAFT: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-600 border-amber-100',
  APPROVED: 'bg-sky-50 text-sky-600 border-sky-100',
  ASSIGNED: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  IN_PROGRESS: 'bg-violet-50 text-violet-600 border-violet-100',
  COMPLETED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
  CANCELLED: 'bg-slate-600/10 text-slate-400 border-slate-600/30',
};

const SLA_STYLES = {
  ON_TRACK: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  DUE_SOON: 'bg-amber-50 text-amber-600 border-amber-200',
  OVERDUE: 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse',
  COMPLETED: 'bg-slate-50 text-slate-500 border-slate-200',
};

const NEXT_STATUS = {
  PROPOSED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  DRAFT: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

function CreateInterventionForm({ onCreated, onClose }) {
  const [form, setForm] = useState({ employeeId: '', title: '', description: '', priority: 'MEDIUM', dueDate: '', targetSlaDays: 14 });
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
      <div className="w-full max-w-md p-6 bg-white border border-slate-100 rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">New Intervention</h2>
        <div className="space-y-3">
          <input placeholder="Employee ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" rows={3} />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800">
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
            <input type="number" placeholder="Target SLA (Days)" value={form.targetSlaDays} onChange={(e) => setForm({ ...form, targetSlaDays: Number(e.target.value) })} className="px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-800" />
          </div>
        </div>
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Cancel</button>
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
  const [outcomeForm, setOutcomeForm] = useState({ currentRisk: 0.2, actualCost: 0, employeeRetained: true, outcomeNotes: '' });
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
      const extra = status === 'ASSIGNED' ? { assignedToUserId: assignUserId } : status === 'COMPLETED' ? outcomeForm : {};
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
  const snapshot = intervention.aiEvidenceSnapshot;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white border-l border-slate-100 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-1 text-[10px] font-bold rounded-full border ${STATUS_STYLES[intervention.status]}`}>{intervention.status}</span>
              {intervention.slaStatus && (
                <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-full border ${SLA_STYLES[intervention.slaStatus] || SLA_STYLES.ON_TRACK}`}>SLA: {intervention.slaStatus}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-2">{intervention.title}</h2>
            <p className="text-xs text-slate-400">{intervention.employeeId?.firstName} {intervention.employeeId?.lastName} · {intervention.priority} priority</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {intervention.description && <p className="text-xs text-slate-500 mb-4">{intervention.description}</p>}
        {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

        {/* AI Evidence Snapshot */}
        {snapshot && (
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl mb-4">
            <h3 className="text-xs font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5">
              <span>🤖 AI Evidence Provenance</span>
            </h3>
            <div className="text-[11px] space-y-1 text-slate-700">
              <p><span className="font-semibold text-slate-800">Initial Attrition Risk:</span> {snapshot.riskScore !== null ? `${Math.round(snapshot.riskScore * 100)}%` : 'N/A'} ({snapshot.riskLevel || 'N/A'})</p>
              {snapshot.shapDrivers?.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-800">Key Drivers:</span>
                  <ul className="list-disc list-inside text-slate-600 pl-1">
                    {snapshot.shapDrivers.map((d, idx) => (
                      <li key={idx}>{typeof d === 'object' ? `${d.feature}: ${d.description || d.impact}` : String(d)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {snapshot.policyCitations?.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-800">Policy Citations:</span>
                  <ul className="list-disc list-inside text-slate-600 pl-1">
                    {snapshot.policyCitations.map((p, idx) => (
                      <li key={idx}>{typeof p === 'object' ? `${p.documentName}: ${p.content}` : String(p)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Outcome Metrics display if completed */}
        {intervention.status === 'COMPLETED' && (
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl mb-4">
            <h3 className="text-xs font-bold text-emerald-900 mb-1.5">Outcome & ROI Metrics</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><span className="text-slate-400">Baseline Risk:</span> {intervention.baselineRisk ? `${Math.round(intervention.baselineRisk * 100)}%` : 'N/A'}</div>
              <div><span className="text-slate-400">Post Risk:</span> {intervention.currentRisk ? `${Math.round(intervention.currentRisk * 100)}%` : 'N/A'}</div>
              <div><span className="text-slate-400">Risk Reduction:</span> {intervention.riskDelta ? `${Math.round(intervention.riskDelta * 100)}%` : 'N/A'}</div>
              <div><span className="text-slate-400">ROI:</span> {intervention.roiPercentage ? `${intervention.roiPercentage}%` : 'N/A'}</div>
              <div><span className="text-slate-400">Retained:</span> {intervention.employeeRetained ? 'Yes' : 'No'}</div>
              <div><span className="text-slate-400">Cost:</span> ${intervention.actualCost || 0}</div>
            </div>
          </div>
        )}

        {/* Transition actions */}
        <div className="space-y-2 mb-4">
          {(NEXT_STATUS[intervention.status] || []).map((s) => (
            <div key={s} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Transition to {s.replace('_', ' ')}</span>
                <button onClick={() => handleTransition(s)} disabled={busy} className="px-3 py-1.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
                  Confirm {s}
                </button>
              </div>
              {s === 'ASSIGNED' && (
                <input placeholder="Assignee User ID" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="px-2 py-1.5 text-[10px] bg-white border border-slate-200 rounded-lg text-slate-800" />
              )}
              {s === 'COMPLETED' && (
                <div className="space-y-1.5 text-[10px]">
                  <div className="grid grid-cols-2 gap-1.5">
                    <input type="number" step="0.01" placeholder="Post-Risk (0.0-1.0)" value={outcomeForm.currentRisk} onChange={(e) => setOutcomeForm({ ...outcomeForm, currentRisk: Number(e.target.value) })} className="px-2 py-1 bg-white border rounded text-slate-800" />
                    <input type="number" placeholder="Actual Cost ($)" value={outcomeForm.actualCost} onChange={(e) => setOutcomeForm({ ...outcomeForm, actualCost: Number(e.target.value) })} className="px-2 py-1 bg-white border rounded text-slate-800" />
                  </div>
                  <input placeholder="Outcome Notes" value={outcomeForm.outcomeNotes} onChange={(e) => setOutcomeForm({ ...outcomeForm, outcomeNotes: e.target.value })} className="w-full px-2 py-1 bg-white border rounded text-slate-800" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Approval chain */}
        {intervention.approval && (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-4">
            <h3 className="text-xs font-bold text-slate-600 mb-2">Approval Chain — {intervention.approval.overallStatus}</h3>
            <div className="space-y-1.5">
              {intervention.approval.chain.map((c) => (
                <div key={c.level} className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Level {c.level} · {c.role}</span>
                  <span className={c.decision === 'APPROVED' ? 'text-emerald-600' : c.decision === 'REJECTED' ? 'text-rose-600' : 'text-amber-600'}>{c.decision}</span>
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
          <h3 className="text-xs font-bold text-slate-600 mb-2">Timeline Audit Trail</h3>
          <div className="space-y-1.5">
            {intervention.statusHistory.map((h, i) => (
              <div key={i} className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">{h.status}</span> — {new Date(h.changedAt).toLocaleString()} {h.note && `· ${h.note}`}
              </div>
            ))}
          </div>
        </div>

        {/* Attachments */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-600">Attachments</h3>
            <label className="text-[10px] text-indigo-600 hover:text-indigo-600 cursor-pointer">
              + Upload
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          {attachments.length === 0 && <p className="text-[11px] text-slate-400 italic">No attachments.</p>}
          {attachments.map((a) => (
            <div key={a._id} className="text-[11px] text-slate-500">{a.originalName} ({Math.round(a.sizeBytes / 1024)}KB)</div>
          ))}
        </div>

        {/* Comments */}
        <div>
          <h3 className="text-xs font-bold text-slate-600 mb-2">Comments</h3>
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
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Interventions</h1>
          <p className="text-xs text-slate-500">Human-in-the-loop attrition mitigation and workflow tracking</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">+ New Intervention</button>
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
        <select onChange={(e) => setFilter((f) => ({ ...f, slaStatus: e.target.value || undefined }))} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
          <option value="">All SLA Statuses</option>
          <option value="ON_TRACK">On Track</option>
          <option value="DUE_SOON">Due Soon</option>
          <option value="OVERDUE">Overdue</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
        {loading && <p className="text-xs text-slate-400 italic p-6 text-center">Loading...</p>}
        {!loading && interventions.length === 0 && <p className="text-xs text-slate-400 italic p-6 text-center">No interventions found.</p>}
        {interventions.map((iv) => (
          <button key={iv._id} onClick={() => setSelectedId(iv._id)} className="w-full text-left flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-100/50">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{iv.title}</p>
                {iv.slaStatus && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${SLA_STYLES[iv.slaStatus] || SLA_STYLES.ON_TRACK}`}>SLA: {iv.slaStatus}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{iv.employeeId?.firstName} {iv.employeeId?.lastName} · {iv.priority} priority</p>
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
