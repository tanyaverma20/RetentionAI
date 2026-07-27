import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHrRecords, createHrRecord, deleteHrRecord, clearHrError, clearHrSuccess, setHrPage } from '../store/slices/hrSlice';
import { fetchEmployees } from '../store/slices/employeeSlice';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function PromotionsPage() {
  const dispatch = useDispatch();
  const { records, total, page, totalPages, loading, error, successMessage } = useSelector((s) => s.hr);
  const { employees } = useSelector((s) => s.employee);
  const { user } = useSelector((s) => s.auth);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [form, setForm] = useState({
    employeeId: '', previousRole: '', newRole: '', promotionDate: new Date().toISOString().slice(0, 10),
    salaryIncreasePercentage: 0, reason: '', approvedBy: '',
  });

  useEffect(() => { dispatch(fetchEmployees({ page: 1, limit: 500 })); }, [dispatch]);
  useEffect(() => {
    const params = { page, limit: 10 };
    if (filterEmployee) params.employeeId = filterEmployee;
    dispatch(fetchHrRecords({ collection: 'promotions', params }));
  }, [dispatch, page, filterEmployee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      promotionDate: new Date(form.promotionDate).toISOString(),
      salaryIncreasePercentage: Number(form.salaryIncreasePercentage),
    };
    await dispatch(createHrRecord({ collection: 'promotions', data }));
    setShowForm(false);
    dispatch(fetchHrRecords({ collection: 'promotions', params: { page: 1, limit: 10 } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-rose-400 uppercase tracking-widest mb-1">
            <span>HR Operations</span><span>•</span><span>{total} Records</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100">Promotion History</h1>
          <p className="text-sm text-slate-400 mt-1">Track employee role changes and salary adjustments.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Promotion
          </button>
        )}
      </div>

      {successMessage && (<div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm"><span>{successMessage}</span><button onClick={() => dispatch(clearHrSuccess())} className="font-bold">×</button></div>)}
      {error && (<div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm"><span>{error}</span><button onClick={() => dispatch(clearHrError())} className="font-bold">×</button></div>)}

      {/* Filter */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-md">
        <select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); dispatch(setHrPage(1)); }}
          className="w-full sm:w-64 px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs">
          <option value="">All Employees</option>
          {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-slate-100">Add Promotion Record</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={form.employeeId} onChange={(e) => setForm({...form, employeeId: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              <option value="">Select Employee</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <input required placeholder="Previous Role" value={form.previousRole} onChange={(e) => setForm({...form, previousRole: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <input required placeholder="New Role" value={form.newRole} onChange={(e) => setForm({...form, newRole: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <input type="date" required value={form.promotionDate} onChange={(e) => setForm({...form, promotionDate: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <input type="number" min="0" required placeholder="Salary Increase %" value={form.salaryIncreasePercentage} onChange={(e) => setForm({...form, salaryIncreasePercentage: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <select required value={form.approvedBy} onChange={(e) => setForm({...form, approvedBy: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              <option value="">Approved By (Manager)</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <input placeholder="Reason / Comments" value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} className="sm:col-span-2 lg:col-span-3 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25">Save Record</button>
          </div>
        </form>
      )}

      {/* Timeline/List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" /></div>
        ) : !records?.length ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
            <h3 className="text-lg font-bold text-slate-200">No promotion records found</h3>
            <p className="text-xs text-slate-400 mt-1">Record a promotion to get started.</p>
          </div>
        ) : records.map((r) => (
          <div key={r._id || r.id} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">{r.employeeId?.firstName || r.employeeId || '—'} {r.employeeId?.lastName || ''}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-400">
                  <span className="line-through opacity-70">{r.previousRole}</span>
                  <span>→</span>
                  <span className="text-indigo-400 font-bold">{r.newRole}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap md:flex-nowrap items-center gap-6">
              <div className="text-xs text-slate-400">
                <div>Date</div>
                <div className="font-semibold text-slate-200">{fmt(r.promotionDate)}</div>
              </div>
              <div className="text-xs text-slate-400">
                <div>Salary Increase</div>
                <div className="font-bold text-emerald-400">+{r.salaryIncreasePercentage}%</div>
              </div>
              {r.reason && (
                <div className="text-xs text-slate-400 max-w-[200px] truncate">
                  <div>Reason</div>
                  <div className="text-slate-200">{r.reason}</div>
                </div>
              )}
              {canManage && (
                <button onClick={() => dispatch(deleteHrRecord({ collection: 'promotions', id: r._id || r.id }))}
                  className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors ml-4 shrink-0" title="Delete">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border border-slate-800 rounded-3xl text-xs text-slate-400">
          <div>Page <span className="font-bold text-slate-200">{page}</span> of <span className="font-bold text-slate-200">{totalPages}</span></div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => dispatch(setHrPage(page - 1))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages} onClick={() => dispatch(setHrPage(page + 1))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
