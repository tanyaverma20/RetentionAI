import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHrRecords, createHrRecord, clearHrError, clearHrSuccess, setHrPage } from '../store/slices/hrSlice';
import { fetchEmployees } from '../store/slices/employeeSlice';

function ScoreBar({ label, value, max = 5, color = 'indigo' }) {
  const pct = Math.round((value / max) * 100);
  const colors = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', violet: 'bg-violet-500' };
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500"><span>{label}</span><span className="font-bold text-slate-800">{value}/{max}</span></div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.indigo}`} style={{ width: `${pct}%` }} /></div>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-100 shadow-card">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-violet-600 uppercase tracking-widest mb-1">
            <span>HR Operations</span><span>•</span><span>{total} Reviews</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Performance Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">Manage quarterly reviews, ratings, goals, and promotion recommendations.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Review
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
          <h2 className="text-lg font-bold text-slate-900">New Performance Review</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={form.employeeId} onChange={(e) => setForm({...form, employeeId: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs">
              <option value="">Select Employee</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <input required placeholder="Review Period (e.g. Q1 2026)" value={form.reviewPeriod} onChange={(e) => setForm({...form, reviewPeriod: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            <select required value={form.reviewerId} onChange={(e) => setForm({...form, reviewerId: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs">
              <option value="">Reviewer</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <div className="space-y-1"><label className="text-xs text-slate-500">Performance Score (1-5)</label><input type="number" min="1" max="5" value={form.performanceScore} onChange={(e) => setForm({...form, performanceScore: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Goal Achievement %</label><input type="number" min="0" max="100" value={form.goalAchievement} onChange={(e) => setForm({...form, goalAchievement: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Leadership (1-5)</label><input type="number" min="1" max="5" value={form.leadershipRating} onChange={(e) => setForm({...form, leadershipRating: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Teamwork (1-5)</label><input type="number" min="1" max="5" value={form.teamworkRating} onChange={(e) => setForm({...form, teamworkRating: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" /></div>
            <input placeholder="Strengths (comma-separated)" value={form.strengths} onChange={(e) => setForm({...form, strengths: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            <input placeholder="Improvement Areas (comma-separated)" value={form.improvementAreas} onChange={(e) => setForm({...form, improvementAreas: e.target.value})} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.promotionRecommendation} onChange={(e) => setForm({...form, promotionRecommendation: e.target.checked})} className="w-4 h-4 rounded bg-slate-50 border-slate-100 text-indigo-600" />
              Recommend for Promotion
            </label>
            <textarea placeholder="Manager Comments" value={form.managerComments} onChange={(e) => setForm({...form, managerComments: e.target.value})} rows={2} className="sm:col-span-2 lg:col-span-3 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-xs" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25">Save Review</button>
          </div>
        </form>
      )}

      {/* Review Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" /></div>
        ) : !records?.length ? (
          <div className="p-12 text-center bg-white border border-slate-100 rounded-3xl">
            <h3 className="text-lg font-bold text-slate-800">No performance reviews found</h3>
            <p className="text-xs text-slate-500 mt-1">Create a review to get started.</p>
          </div>
        ) : records.map((r) => (
          <div key={r._id || r.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{r.reviewPeriod}</h3>
                <p className="text-xs text-slate-500">Employee: {r.employeeId?.firstName || r.employeeId || '—'} {r.employeeId?.lastName || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {r.promotionRecommendation && (<span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full border bg-amber-50 text-amber-600 border-amber-100">⭐ Promo Ready</span>)}
                <span className="px-3 py-1 text-lg font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl">{r.performanceScore}/5</span>
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
                {r.strengths?.length > 0 && (<div><p className="text-xs font-semibold text-emerald-600 mb-1">Strengths</p><div className="flex flex-wrap gap-1">{r.strengths.map((s, i) => <span key={i} className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">{s}</span>)}</div></div>)}
                {r.improvementAreas?.length > 0 && (<div><p className="text-xs font-semibold text-rose-600 mb-1">Areas for Improvement</p><div className="flex flex-wrap gap-1">{r.improvementAreas.map((s, i) => <span key={i} className="px-2 py-0.5 text-[10px] bg-rose-50 text-rose-600 border border-rose-100 rounded-full">{s}</span>)}</div></div>)}
              </div>
            )}
            {r.managerComments && <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-3">&quot;{r.managerComments}&quot;</p>}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-100 rounded-3xl text-xs text-slate-500">
          <div>Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span></div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => dispatch(setHrPage(page - 1))} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages} onClick={() => dispatch(setHrPage(page + 1))} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
