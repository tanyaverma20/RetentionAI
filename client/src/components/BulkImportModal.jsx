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

export default function BulkImportModal({ isOpen, onClose, onImport, loading = false, importSummary = null, defaultCollection = 'employees' }) {
  const [csvText, setCsvText] = useState('');
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'file'
  const [collection, setCollection] = useState(defaultCollection);

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
    onImport({ csvText, collection });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Universal Data Import</h2>
              <p className="text-xs text-slate-400">Import HR data records using CSV text or file upload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selection & Sample Action */}
        <div className="px-6 pt-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Paste CSV Content
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'file'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload CSV File
            </button>
          </div>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="pb-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Sample CSV
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Select Data Collection
            </label>
            <select
              value={collection}
              onChange={(e) => { setCollection(e.target.value); setCsvText(''); }}
              className="w-full sm:w-1/2 px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-sm outline-none"
            >
              {COLLECTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {activeTab === 'text' ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                CSV Raw Text
              </label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={TEMPLATES[collection]}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 placeholder-slate-600 font-mono text-xs focus:outline-none transition-colors resize-none"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center bg-slate-950/50 transition-colors">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                id="csv-file-input"
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">Click to select a CSV file</p>
                  <p className="text-xs text-slate-500">Supports standard UTF-8 .csv files</p>
                </div>
              </label>
              {csvText && (
                <div className="mt-4 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-mono">
                  CSV Loaded ({csvText.split('\n').length - 1} rows detected)
                </div>
              )}
            </div>
          )}

          {/* Import Summary Results */}
          {importSummary && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-emerald-400">Imported: {importSummary.importedCount}</span>
                <span className={importSummary.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}>
                  Failed: {importSummary.failedCount}
                </span>
              </div>

              {importSummary.errors && importSummary.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importSummary.errors.map((err, idx) => (
                    <div key={idx} className="text-xs text-rose-400 font-mono bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
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
