import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHrRecords, createHrRecord, deleteHrRecord, clearHrError, clearHrSuccess, setHrPage } from '../store/slices/hrSlice';
import { fetchEmployees } from '../store/slices/employeeSlice';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function TrainingPage() {
  const dispatch = useDispatch();
  const { records, total, page, totalPages, loading, error, successMessage } = useSelector((s) => s.hr);
  const { employees } = useSelector((s) => s.employee);
  const { user } = useSelector((s) => s.auth);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [form, setForm] = useState({
    employeeId: '', courseName: '', provider: '', completionDate: new Date().toISOString().slice(0, 10),
    durationHours: 0, certificationEarned: false, score: '', remarks: '',
  });

  useEffect(() => { dispatch(fetchEmployees({ page: 1, limit: 500 })); }, [dispatch]);
  useEffect(() => {
    const params = { page, limit: 10 };
    if (filterEmployee) params.employeeId = filterEmployee;
    dispatch(fetchHrRecords({ collection: 'training', params }));
  }, [dispatch, page, filterEmployee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      completionDate: new Date(form.completionDate).toISOString(),
      durationHours: Number(form.durationHours),
    };
    if (data.score) data.score = Number(data.score);
    else delete data.score;
    await dispatch(createHrRecord({ collection: 'training', data }));
    setShowForm(false);
    dispatch(fetchHrRecords({ collection: 'training', params: { page: 1, limit: 10 } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-100 shadow-card">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-sky-600 uppercase tracking-widest mb-1">
            <span>HR Operations</span><span>•</span><span>{total} Records</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Training Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track employee training, certifications, and skill development.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Training Record
          </button>
        )}
      </div>

      {successMessage && (<div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-sm"><span>{successMessage}</span><button onClick={() => dispatch(clearHrSuccess())} className="font-bold">×</button></div>)}
      {error && (<div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm"><span>{error}</span><button onClick={() => dispatch(clearHrError())} className="font-bold">×</button></div>)}

      {/* Filter */}
      <div className="p-4 bg-white/80 border border-slate-100 rounded-3xl backdrop-blur-md">
        <select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); dispatch(setHrPage(1)); }}
          className="w-full sm:w-64 px-3.5 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl text-slate-800 text-xs">
          <option value="">All Employees</option>
          {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4 shadow-card">
          <h2 className="text-lg font-bold text-slate-900">Add Training Record</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={form.employeeId} onChange={(e) => setForm({...form, employeeId: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs">
              <option value="">Select Employee</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <input required placeholder="Course Name" value={form.courseName} onChange={(e) => setForm({...form, courseName: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            <input required placeholder="Provider (e.g. Coursera)" value={form.provider} onChange={(e) => setForm({...form, provider: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            <input type="date" required value={form.completionDate} onChange={(e) => setForm({...form, completionDate: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            <div className="flex items-center gap-2">
              <input type="number" min="0" required placeholder="Duration (Hrs)" value={form.durationHours} onChange={(e) => setForm({...form, durationHours: e.target.value})} className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
              <input type="number" min="0" max="100" placeholder="Score (%)" value={form.score} onChange={(e) => setForm({...form, score: e.target.value})} className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.certificationEarned} onChange={(e) => setForm({...form, certificationEarned: e.target.checked})} className="w-4 h-4 rounded bg-slate-50 border-slate-100 text-indigo-600" />
              Certification Earned
            </label>
            <input placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({...form, remarks: e.target.value})} className="sm:col-span-2 lg:col-span-3 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25">Save Record</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-card">
        {loading ? (
          <div className="flex items-center justify-center p-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" /></div>
        ) : !records?.length ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-bold text-slate-800">No training records found</h3>
            <p className="text-xs text-slate-500 mt-1">Add a training record to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-white/80 text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Course & Provider</th>
                  <th className="px-6 py-4">Completion Date</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Certification</th>
                  {canManage && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {records.map((r) => (
                  <tr key={r._id || r.id} className="hover:bg-slate-100/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800">{r.employeeId?.firstName || r.employeeId || '—'} {r.employeeId?.lastName || ''}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{r.courseName}</div>
                      <div className="text-xs text-slate-400">{r.provider}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{fmt(r.completionDate)}</td>
                    <td className="px-6 py-4 text-xs">
                      <div className="text-slate-600">{r.durationHours} Hours</div>
                      {r.score != null && <div className="text-slate-400">Score: {r.score}%</div>}
                    </td>
                    <td className="px-6 py-4">
                      {r.certificationEarned ? (
                        <span className="inline-block px-2.5 py-1 text-xs font-mono font-semibold rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100">🎓 Earned</span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 text-xs font-mono font-semibold rounded-full border bg-slate-500/10 text-slate-500 border-slate-500/20">None</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => dispatch(deleteHrRecord({ collection: 'training', id: r._id || r.id }))}
                          className="p-2 text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-slate-100 rounded-xl transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
            <div>Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span></div>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => dispatch(setHrPage(page - 1))} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => dispatch(setHrPage(page + 1))} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
