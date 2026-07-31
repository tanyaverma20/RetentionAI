import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHrRecords, createHrRecord, clearHrError, clearHrSuccess, setHrPage } from '../store/slices/hrSlice';
import { fetchEmployees } from '../store/slices/employeeSlice';

function ScoreBar({ label, value, max = 5, color = 'indigo' }) {
  const pct = Math.round((value / max) * 100);
  const colors = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', violet: 'bg-violet-500' };
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400"><span>{label}</span><span className="font-bold text-slate-200">{value}/{max}</span></div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.indigo}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function PerformancePage() {
  const dispatch = useDispatch();
  const { records, total, page, totalPages, loading, error, successMessage } = useSelector((s) => s.hr);
  const { employees } = useSelector((s) => s.employee);
  const { user } = useSelector((s) => s.auth);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [form, setForm] = useState({
    employeeId: '', reviewPeriod: '', reviewerId: '',
    performanceScore: 3, goalAchievement: 0, strengths: '',
    improvementAreas: '', leadershipRating: 3, teamworkRating: 3,
    promotionRecommendation: false, managerComments: '',
  });

  useEffect(() => { dispatch(fetchEmployees({ page: 1, limit: 500 })); }, [dispatch]);
  useEffect(() => {
    const params = { page, limit: 10 };
    if (filterEmployee) params.employeeId = filterEmployee;
    dispatch(fetchHrRecords({ collection: 'performance', params }));
  }, [dispatch, page, filterEmployee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      performanceScore: Number(form.performanceScore),
      goalAchievement: Number(form.goalAchievement),
      leadershipRating: Number(form.leadershipRating),
      teamworkRating: Number(form.teamworkRating),
      strengths: form.strengths ? form.strengths.split(',').map(s => s.trim()).filter(Boolean) : [],
      improvementAreas: form.improvementAreas ? form.improvementAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    await dispatch(createHrRecord({ collection: 'performance', data }));
    setShowForm(false);
    dispatch(fetchHrRecords({ collection: 'performance', params: { page: 1, limit: 10 } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-violet-400 uppercase tracking-widest mb-1">
            <span>HR Operations</span><span>•</span><span>{total} Reviews</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100">Performance Reviews</h1>
          <p className="text-sm text-slate-400 mt-1">Manage quarterly reviews, ratings, goals, and promotion recommendations.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Review
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
          <h2 className="text-lg font-bold text-slate-100">New Performance Review</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={form.employeeId} onChange={(e) => setForm({...form, employeeId: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              <option value="">Select Employee</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <input required placeholder="Review Period (e.g. Q1 2026)" value={form.reviewPeriod} onChange={(e) => setForm({...form, reviewPeriod: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <select required value={form.reviewerId} onChange={(e) => setForm({...form, reviewerId: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              <option value="">Reviewer</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <div className="space-y-1"><label className="text-xs text-slate-400">Performance Score (1-5)</label><input type="number" min="1" max="5" value={form.performanceScore} onChange={(e) => setForm({...form, performanceScore: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Goal Achievement %</label><input type="number" min="0" max="100" value={form.goalAchievement} onChange={(e) => setForm({...form, goalAchievement: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Leadership (1-5)</label><input type="number" min="1" max="5" value={form.leadershipRating} onChange={(e) => setForm({...form, leadershipRating: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-400">Teamwork (1-5)</label><input type="number" min="1" max="5" value={form.teamworkRating} onChange={(e) => setForm({...form, teamworkRating: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" /></div>
            <input placeholder="Strengths (comma-separated)" value={form.strengths} onChange={(e) => setForm({...form, strengths: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <input placeholder="Improvement Areas (comma-separated)" value={form.improvementAreas} onChange={(e) => setForm({...form, improvementAreas: e.target.value})} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.promotionRecommendation} onChange={(e) => setForm({...form, promotionRecommendation: e.target.checked})} className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600" />
              Recommend for Promotion
            </label>
            <textarea placeholder="Manager Comments" value={form.managerComments} onChange={(e) => setForm({...form, managerComments: e.target.value})} rows={2} className="sm:col-span-2 lg:col-span-3 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25">Save Review</button>
          </div>
        </form>
      )}

      {/* Review Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" /></div>
        ) : !records?.length ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
            <h3 className="text-lg font-bold text-slate-200">No performance reviews found</h3>
            <p className="text-xs text-slate-400 mt-1">Create a review to get started.</p>
          </div>
        ) : records.map((r) => (
          <div key={r._id || r.id} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">{r.reviewPeriod}</h3>
                <p className="text-xs text-slate-400">Employee: {r.employeeId?.firstName || r.employeeId || '—'} {r.employeeId?.lastName || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.promotionRecommendation && (<span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">⭐ Promo Ready</span>)}
                <span className="px-3 py-1 text-lg font-extrabold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">{r.performanceScore}/5</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ScoreBar label="Performance" value={r.performanceScore} color="indigo" />
              <ScoreBar label="Leadership" value={r.leadershipRating} color="violet" />
              <ScoreBar label="Teamwork" value={r.teamworkRating} color="emerald" />
              <ScoreBar label="Goal Achievement" value={r.goalAchievement} max={100} color="amber" />
            </div>
            {(r.strengths?.length > 0 || r.improvementAreas?.length > 0) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {r.strengths?.length > 0 && (<div><p className="text-xs font-semibold text-emerald-400 mb-1">Strengths</p><div className="flex flex-wrap gap-1">{r.strengths.map((s, i) => <span key={i} className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full">{s}</span>)}</div></div>)}
                {r.improvementAreas?.length > 0 && (<div><p className="text-xs font-semibold text-rose-400 mb-1">Areas for Improvement</p><div className="flex flex-wrap gap-1">{r.improvementAreas.map((s, i) => <span key={i} className="px-2 py-0.5 text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-full">{s}</span>)}</div></div>)}
              </div>
            )}
            {r.managerComments && <p className="mt-3 text-xs text-slate-400 italic border-t border-slate-800 pt-3">&quot;{r.managerComments}&quot;</p>}
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
