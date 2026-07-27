import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHrRecords, createHrRecord, deleteHrRecord, clearHrError, clearHrSuccess, setHrPage } from '../store/slices/hrSlice';
import { fetchEmployees } from '../store/slices/employeeSlice';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

const STATUS_COLORS = {
  PRESENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ABSENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  HALF_DAY: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ON_LEAVE: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  HOLIDAY: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

export default function AttendancePage() {
  const dispatch = useDispatch();
  const { records, total, page, totalPages, loading, error, successMessage } = useSelector((s) => s.hr);
  const { employees } = useSelector((s) => s.employee);
  const { user } = useSelector((s) => s.auth);
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    employeeId: '', attendanceDate: new Date().toISOString().slice(0, 10),
    checkInTime: '', checkOutTime: '', attendanceStatus: 'PRESENT',
    leaveType: 'NONE', workMode: 'OFFICE', remarks: '',
  });

  useEffect(() => { dispatch(fetchEmployees({ page: 1, limit: 500 })); }, [dispatch]);
  useEffect(() => {
    const params = { page, limit: 10 };
    if (filterEmployee) params.employeeId = filterEmployee;
    dispatch(fetchHrRecords({ collection: 'attendance', params }));
  }, [dispatch, page, filterEmployee, filterStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form };
    data.attendanceDate = new Date(data.attendanceDate).toISOString();
    if (data.checkInTime) data.checkInTime = new Date(`${form.attendanceDate}T${data.checkInTime}`).toISOString();
    else data.checkInTime = null;
    if (data.checkOutTime) data.checkOutTime = new Date(`${form.attendanceDate}T${data.checkOutTime}`).toISOString();
    else data.checkOutTime = null;
    await dispatch(createHrRecord({ collection: 'attendance', data }));
    setShowForm(false);
    dispatch(fetchHrRecords({ collection: 'attendance', params: { page: 1, limit: 10 } }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400 uppercase tracking-widest mb-1">
            <span>HR Operations</span><span>•</span><span>{total} Records</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100">Attendance Management</h1>
          <p className="text-sm text-slate-400 mt-1">Track daily attendance, clock-in/out times, and leave records.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Record Attendance
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm">
          <span>{successMessage}</span>
          <button onClick={() => dispatch(clearHrSuccess())} className="font-bold">×</button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          <span>{error}</span>
          <button onClick={() => dispatch(clearHrError())} className="font-bold">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); dispatch(setHrPage(1)); }}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs">
            <option value="">All Employees</option>
            {(employees || []).map((emp) => (
              <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs">
            <option value="">All Statuses</option>
            {['PRESENT','ABSENT','HALF_DAY','ON_LEAVE','HOLIDAY'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Form Drawer */}
      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-slate-100">Record Attendance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={form.employeeId} onChange={(e) => setForm({...form, employeeId: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              <option value="">Select Employee</option>
              {(employees || []).map((emp) => <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <input type="date" required value={form.attendanceDate} onChange={(e) => setForm({...form, attendanceDate: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <select required value={form.attendanceStatus} onChange={(e) => setForm({...form, attendanceStatus: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              {['PRESENT','ABSENT','HALF_DAY','ON_LEAVE','HOLIDAY'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <input type="time" placeholder="Clock In" value={form.checkInTime} onChange={(e) => setForm({...form, checkInTime: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <input type="time" placeholder="Clock Out" value={form.checkOutTime} onChange={(e) => setForm({...form, checkOutTime: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
            <select value={form.workMode} onChange={(e) => setForm({...form, workMode: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              {['OFFICE','REMOTE','HYBRID'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={form.leaveType} onChange={(e) => setForm({...form, leaveType: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs">
              {['NONE','SICK','CASUAL','ANNUAL','MATERNITY','PATERNITY','UNPAID'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({...form, remarks: e.target.value})}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25">Save</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center p-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" /></div>
        ) : !records?.length ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-bold text-slate-200">No attendance records found</h3>
            <p className="text-xs text-slate-400 mt-1">Try adjusting filters or add new records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Clock In</th>
                  <th className="px-6 py-4">Clock Out</th>
                  <th className="px-6 py-4">Hours</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Mode</th>
                  {canManage && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.map((r) => (
                  <tr key={r._id || r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-200">{r.employeeId?.firstName || r.employeeId || '—'} {r.employeeId?.lastName || ''}</td>
                    <td className="px-6 py-4 font-mono text-xs">{fmt(r.attendanceDate)}</td>
                    <td className="px-6 py-4 text-xs">{fmtTime(r.checkInTime)}</td>
                    <td className="px-6 py-4 text-xs">{fmtTime(r.checkOutTime)}</td>
                    <td className="px-6 py-4 text-xs">{r.totalHoursWorked || 0}h</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-mono font-semibold rounded-full border ${STATUS_COLORS[r.attendanceStatus] || ''}`}>
                        {r.attendanceStatus?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{r.workMode}</td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => dispatch(deleteHrRecord({ collection: 'attendance', id: r._id || r.id }))}
                          className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors" title="Delete">
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
          <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
            <div>Page <span className="font-bold text-slate-200">{page}</span> of <span className="font-bold text-slate-200">{totalPages}</span> ({total} records)</div>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => dispatch(setHrPage(page - 1))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => dispatch(setHrPage(page + 1))} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
