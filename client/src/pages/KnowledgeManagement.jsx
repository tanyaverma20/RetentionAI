import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { knowledgeService } from '../services/knowledgeService';

const DOCUMENT_TYPES = [
  'HR_POLICY', 'EMPLOYEE_HANDBOOK', 'LEAVE_POLICY', 'PROMOTION_POLICY',
  'COMPENSATION_POLICY', 'PERFORMANCE_GUIDELINES', 'TRAINING_DOCUMENT',
  'COMPLIANCE_DOCUMENT', 'SOP', 'OTHER',
];

const STATUS_STYLES = {
  INDEXED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PROCESSING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  FAILED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

function UploadModal({ isOpen, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('HR_POLICY');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await knowledgeService.uploadDocument({
        file,
        documentType,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setFile(null);
      setTags('');
      onUploaded();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to upload document.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-slate-100">Upload Knowledge Document</h3>
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">File (PDF, DOCX, TXT, MD)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-xs text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-xs file:font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            >
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. 2026, engineering, revised"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
              {loading ? 'Uploading…' : 'Upload & Index'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SearchPanel() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('semantic');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      setLoading(true);
      setError('');
      const data = await knowledgeService.search({ q, mode, topK: 10 });
      setResults(data.results);
    } catch (err) {
      setError(extractErrorMessage(err, 'Search failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">Knowledge Search</h2>
        <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
          {['semantic', 'keyword'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              {m === 'semantic' ? 'Semantic' : 'Keyword'}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search policies, e.g. 'annual leave carry forward'"
          className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">{error}</div>}
      {results && (
        <div className="space-y-2">
          {results.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">No matches found.</p>}
          {results.map((r, i) => (
            <div key={i} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-300">{r.documentName}</span>
                {r.similarityScore != null && (
                  <span className="text-[10px] font-mono text-slate-500">{(r.similarityScore * 100).toFixed(0)}% match</span>
                )}
              </div>
              <p className="text-xs text-slate-400">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeManagement() {
  const { user } = useSelector((state) => state.auth);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isReindexingAll, setIsReindexingAll] = useState(false);
  const [message, setMessage] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await knowledgeService.listDocuments({ documentType: typeFilter || undefined });
      setDocuments(data.items);
      setError('');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load knowledge documents.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const handleReindex = async (documentId) => {
    try {
      await knowledgeService.reindexDocument(documentId);
      loadDocuments();
    } catch (err) {
      setError(extractErrorMessage(err, 'Re-index failed.'));
    }
  };

  const handleReindexAll = async () => {
    try {
      setIsReindexingAll(true);
      const result = await knowledgeService.reindexAll();
      setMessage(`Re-indexed ${result.succeeded}/${result.totalCount} documents.`);
      loadDocuments();
    } catch (err) {
      setError(extractErrorMessage(err, 'Bulk re-index failed.'));
    } finally {
      setIsReindexingAll(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await knowledgeService.deleteDocument(deleteConfirm._id);
      setDeleteConfirm(null);
      loadDocuments();
    } catch (err) {
      setError(extractErrorMessage(err, 'Delete failed.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest mb-1">
            <span>Knowledge Intelligence</span>
            <span>•</span>
            <span>{documents.length} Documents</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100">Knowledge Management</h1>
          <p className="text-sm text-slate-400 mt-1">Upload, index, and manage HR policy documents for grounded knowledge lookup.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            {message && <span className="text-xs text-indigo-400">{message}</span>}
            <button
              onClick={handleReindexAll}
              disabled={isReindexingAll}
              className="px-4 py-2.5 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl disabled:opacity-50 transition-all"
            >
              {isReindexingAll ? 'Re-indexing…' : 'Re-index All'}
            </button>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
            >
              Upload Document
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-300 font-bold">×</button>
        </div>
      )}

      <SearchPanel />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">Indexed Documents</h2>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none"
          >
            <option value="">All Types</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">No documents indexed yet. Upload one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Filename</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Uploaded By</th>
                  <th className="px-6 py-4">Upload Date</th>
                  <th className="px-6 py-4">Version</th>
                  <th className="px-6 py-4">Tags</th>
                  <th className="px-6 py-4">Chunks</th>
                  <th className="px-6 py-4">Status</th>
                  {canManage && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documents.map((doc) => (
                  <tr key={doc._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-100">{doc.filename}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{doc.documentType?.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{doc.uploadedBy?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">v{doc.version}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(doc.tags || []).map((t, i) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] font-mono text-slate-300 bg-slate-800/60 border border-slate-700 rounded-full">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{doc.chunkCount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-[10px] font-mono font-semibold uppercase rounded-full border ${STATUS_STYLES[doc.status] || ''}`}>
                        {doc.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReindex(doc._id)}
                            title="Re-index"
                            className="p-2 text-slate-400 hover:text-indigo-300 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(doc)}
                            title="Delete"
                            className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploaded={loadDocuments} />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-100">Delete Document</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <span className="text-slate-200 font-bold">{deleteConfirm.filename}</span>? This removes it from the knowledge base permanently.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
