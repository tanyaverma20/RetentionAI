import React, { useState } from 'react';

const TEMPLATES = {
  employees: `employeeCode,firstName,lastName,email,department,designation,joiningDate,salary\nEMP-101,Sarah,Connor,sarah.c@company.com,ENG,Lead Engineer,2024-01-10,135000\nEMP-102,David,Miller,david.m@company.com,HR,HR Specialist,2024-02-15,85000`,
  attendance: `employeeId,attendanceDate,attendanceStatus,totalHoursWorked,overtimeHours,workMode\nEMP-101,2024-03-01,PRESENT,8,2,OFFICE\nEMP-102,2024-03-01,ABSENT,0,0,REMOTE`,
  performance: `employeeId,reviewPeriod,performanceScore,goalAchievement,promotionRecommendation\nEMP-101,2024-Q1,4.5,95,true\nEMP-102,2024-Q1,3.8,80,false`,
  training: `employeeId,courseName,provider,completionDate,durationHours,certificationEarned,score\nEMP-101,Advanced React,Coursera,2024-03-15,40,true,92\nEMP-102,HR Compliance,Internal,2024-03-10,4,false,`,
  promotions: `employeeId,previousRole,newRole,promotionDate,salaryIncreasePercentage,reason\nEMP-101,Senior Engineer,Lead Engineer,2024-04-01,15,Exceptional performance\n`,
  surveys: `employeeId,surveyDate,engagementScore,jobSatisfaction,workLifeBalance,careerGrowthScore,managerRelationshipScore,stressLevel\nEMP-101,2024-01-15,4,5,3,4,5,2\nEMP-102,2024-01-15,3,3,4,3,3,4`,
  feedback: `employeeId,feedbackDate,category,feedbackText\nEMP-101,2024-02-10,WORK_ENVIRONMENT,Need better office chairs\n`,
  managerNotes: `employeeId,noteDate,observation,recommendation,performanceConcern,promotionDiscussion,followUpRequired\nEMP-101,2024-03-20,Great leadership skills,Consider for management,false,true,false\n`,
};

const COLLECTION_OPTIONS = [
  { value: 'employees', label: 'Employees' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'performance', label: 'Performance Reviews' },
  { value: 'training', label: 'Training Records' },
  { value: 'promotions', label: 'Promotions' },
  { value: 'surveys', label: 'Surveys' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'managerNotes', label: 'Manager Notes' },
];

import { useDispatch } from 'react-redux';
import { predictBatchEmployees } from '../store/slices/employeeSlice';

export default function BulkImportModal({ isOpen, onClose, onImport, loading = false, importSummary = null, defaultCollection = 'employees' }) {
  const [csvText, setCsvText] = useState('');
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'file'
  const [collection, setCollection] = useState(defaultCollection);
  const [mode, setMode] = useState('FULL_SNAPSHOT');
  const [isPredicting, setIsPredicting] = useState(false);
  const dispatch = useDispatch();

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCsvText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    onImport({ csvText, collection, mode });
  };

  const handleDownloadSample = () => {
    const blob = new Blob([TEMPLATES[collection]], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection}_import_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePredictBatch = async () => {
    try {
      setIsPredicting(true);
      await dispatch(predictBatchEmployees()).unwrap();
      setIsPredicting(false);
      onClose(); // Close modal on success
    } catch {
      setIsPredicting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 overflow-hidden bg-white border border-slate-100 rounded-2xl shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Universal Data Import</h2>
              <p className="text-xs text-slate-500">Import HR data records using CSV text or file upload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selection & Sample Action */}
        <div className="px-6 pt-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Paste CSV Content
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'file'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Upload CSV File
            </button>
          </div>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="pb-3 text-xs font-semibold text-indigo-600 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Sample CSV
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Select Data Collection
              </label>
              <select
                value={collection}
                onChange={(e) => { setCollection(e.target.value); setCsvText(''); }}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl text-slate-800 text-sm outline-none"
              >
                {COLLECTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {collection === 'employees' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Import Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl text-slate-800 text-sm outline-none"
                >
                  <option value="FULL_SNAPSHOT">Full Snapshot (Deactivates Missing)</option>
                  <option value="PARTIAL_UPDATE">Partial Update (Preserves Missing)</option>
                </select>
              </div>
            )}
          </div>

          {activeTab === 'text' ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                CSV Raw Text
              </label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={TEMPLATES[collection]}
                className="w-full p-3.5 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl text-slate-900 placeholder-slate-600 font-mono text-xs focus:outline-none transition-colors resize-none"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-100 hover:border-indigo-100 rounded-2xl p-8 text-center bg-slate-50 transition-colors">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                id="csv-file-input"
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Click to select a CSV file</p>
                  <p className="text-xs text-slate-400">Supports standard UTF-8 .csv files</p>
                </div>
              </label>
              {csvText && (
                <div className="mt-4 p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 text-xs font-mono">
                  CSV Loaded ({csvText.split('\n').length - 1} rows detected)
                </div>
              )}
            </div>
          )}

          {/* Import Summary Results */}
          {importSummary && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold uppercase tracking-wider">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                  <div>New</div>
                  <div className="text-base font-extrabold">{importSummary.new ?? importSummary.importedCount ?? 0}</div>
                </div>
                <div className="p-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                  <div>Changed</div>
                  <div className="text-base font-extrabold">{importSummary.changed ?? 0}</div>
                </div>
                <div className="p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  <div>Unchanged</div>
                  <div className="text-base font-extrabold">{importSummary.unchanged ?? 0}</div>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                  <div>Inactive</div>
                  <div className="text-base font-extrabold">{importSummary.inactive ?? 0}</div>
                </div>
                <div className="p-2 bg-rose-50 text-rose-700 rounded-lg border border-rose-100">
                  <div>Errors</div>
                  <div className="text-base font-extrabold">{importSummary.validationErrors ?? importSummary.failedCount ?? 0}</div>
                </div>
              </div>

              {importSummary.errors && importSummary.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importSummary.errors.map((err, idx) => (
                    <div key={idx} className="text-xs text-rose-600 font-mono bg-rose-50 p-1.5 rounded border border-rose-100">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

              {collection === 'employees' && importSummary.importedCount > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">New employees added. Would you like to generate AI attrition predictions for the workforce?</p>
                  <button
                    type="button"
                    onClick={handlePredictBatch}
                    disabled={isPredicting}
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all"
                  >
                    {isPredicting ? 'Generating...' : '🧠 Generate AI Predictions'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !csvText.trim()}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing Import...' : 'Start CSV Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
