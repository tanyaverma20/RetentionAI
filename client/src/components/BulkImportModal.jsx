import React, { useState } from 'react';

const SAMPLE_CSV = `employeeCode,firstName,lastName,email,department,designation,joiningDate,salary
EMP-101,Sarah,Connor,sarah.c@company.com,ENG,Lead Engineer,2024-01-10,135000
EMP-102,David,Miller,david.m@company.com,HR,HR Specialist,2024-02-15,85000`;

export default function BulkImportModal({ isOpen, onClose, onImport, loading = false, importSummary = null }) {
  const [csvText, setCsvText] = useState('');
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'file'

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
    onImport({ csvText });
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
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
              <h2 className="text-xl font-bold text-slate-100">Bulk Import Employees</h2>
              <p className="text-xs text-slate-400">Import employee records using CSV text or file upload</p>
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
          {activeTab === 'text' ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                CSV Raw Text
              </label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={SAMPLE_CSV}
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
