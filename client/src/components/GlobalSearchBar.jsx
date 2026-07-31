import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enterpriseSearchService } from '../services/workflowService';

const CATEGORY_LABELS = {
  employees: 'Employees',
  departments: 'Departments',
  recommendations: 'Recommendations',
  tasks: 'Tasks',
  interventions: 'Interventions',
  comments: 'Comments',
  knowledge: 'Knowledge Base',
};

export default function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const data = await enterpriseSearchService.search(query.trim());
        setResults(data);
        setOpen(true);
      } catch {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalCount = results ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0) : 0;

  const goToEmployee = (id) => { navigate(`/employees/${id}`); setOpen(false); setQuery(''); };

  return (
    <div className="relative w-full max-w-xs" ref={containerRef}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
        placeholder="Search everything..."
        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {open && results && (
        <div className="absolute left-0 mt-2 w-96 max-h-96 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50">
          {totalCount === 0 && <p className="text-xs text-slate-500 italic p-4 text-center">No results for &quot;{query}&quot;.</p>}
          {Object.entries(results).map(([category, items]) => items.length > 0 && (
            <div key={category} className="p-3 border-b border-slate-800 last:border-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600 mb-1.5">{CATEGORY_LABELS[category] || category} ({items.length})</p>
              <div className="space-y-1">
                {items.slice(0, 5).map((item) => (
                  <button
                    key={item._id}
                    onClick={() => category === 'employees' ? goToEmployee(item._id) : setOpen(false)}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg truncate"
                  >
                    {item.name || item.title || item.filename || item.recommendationType || item.body?.slice(0, 60) || item._id}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
