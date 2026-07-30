import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import SurveyForm from '../components/SurveyForm';
import FeedbackForm from '../components/FeedbackForm';
import { createHrRecord, fetchHrRecords, clearHrError, clearHrSuccess } from '../store/slices/hrSlice';
import { fetchEmployees } from '../store/slices/employeeSlice';

const formatDate = (date) => (date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function EmployeeVoicePage() {
  const dispatch = useDispatch();
  const { records, loading, error, successMessage } = useSelector((state) => state.hr);
  const { employees } = useSelector((state) => state.employee);
  const [mode, setMode] = useState('surveys');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => { dispatch(fetchEmployees({ page: 1, limit: 500 })); }, [dispatch]);
  useEffect(() => { dispatch(fetchHrRecords({ collection: mode, params: { page: 1, limit: 50 } })); }, [dispatch, mode]);

  const submit = async (data) => {
    const action = await dispatch(createHrRecord({ collection: mode, data }));
    if (!action.error) {
      setEmployeeId('');
      dispatch(fetchHrRecords({ collection: mode, params: { page: 1, limit: 50 } }));
    }
  };

  const isSurvey = mode === 'surveys';
  return (
    <div className="space-y-6">
      <header className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <p className="text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">Employee experience</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-100">Employee Voice</h1>
        <p className="mt-2 text-sm text-slate-400">Capture historical survey responses and employee feedback with a complete timestamped trail.</p>
      </header>

      <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        {[['surveys', 'Surveys'], ['feedback', 'Feedback']].map(([value, label]) => <button key={value} onClick={() => { setMode(value); setEmployeeId(''); }} className={`px-4 py-2 text-sm font-semibold rounded-xl ${mode === value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{label}</button>)}
      </div>

      {successMessage && <div className="flex justify-between p-4 rounded-2xl text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">{successMessage}<button onClick={() => dispatch(clearHrSuccess())}>×</button></div>}
      {error && <div className="flex justify-between p-4 rounded-2xl text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20">{error}<button onClick={() => dispatch(clearHrError())}>×</button></div>}

      <section className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <label className="block mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Employee</label>
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="w-full md:w-96 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200">
          <option value="">Select employee to submit a {isSurvey ? 'survey' : 'feedback entry'}</option>
          {(employees || []).map((employee) => <option key={employee._id || employee.id} value={employee._id || employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeCode}</option>)}
        </select>
        {employeeId && (isSurvey ? <SurveyForm employeeId={employeeId} onSubmit={submit} onCancel={() => setEmployeeId('')} /> : <FeedbackForm employeeId={employeeId} onSubmit={submit} onCancel={() => setEmployeeId('')} />)}
      </section>

      <section className="overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800"><h2 className="font-bold text-slate-100">Historical {isSurvey ? 'Survey Responses' : 'Feedback'}</h2></div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading records…</div> : !records?.length ? <div className="p-12 text-center text-sm text-slate-500">No entries recorded yet.</div> : <div className="divide-y divide-slate-800">{records.map((record) => <div key={record._id || record.id} className="p-5"><div className="flex justify-between gap-4"><div><p className="font-semibold text-slate-200">{record.employeeId?.firstName ? `${record.employeeId.firstName} ${record.employeeId.lastName}` : 'Employee record'}</p><p className="text-xs text-slate-500">{formatDate(record.surveyDate || record.feedbackDate || record.createdAt)}</p></div>{isSurvey ? <span className="text-sm text-indigo-300">Happiness {record.overallHappiness}/5</span> : <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">{record.anonymous ? 'Anonymous' : record.category}</span>}</div><p className="mt-2 text-sm text-slate-400">{isSurvey ? (record.surveyComments || 'No additional comments.') : record.feedbackText}</p></div>)}</div>}
      </section>
    </div>
  );
}
