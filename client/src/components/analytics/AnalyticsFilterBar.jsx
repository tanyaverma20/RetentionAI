import React from 'react';

export default function AnalyticsFilterBar({
  filters = {},
  departments = [],
  onFilterChange,
  onResetFilters,
}) {
  return (
    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-3 backdrop-blur-md shadow-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search input */}
        <div className="relative lg:col-span-2">
          <svg
            className="w-4 h-4 absolute left-3.5 top-3 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search analytics by name, code, designation..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-xs placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Department Filter */}
        <select
          value={filters.departmentId || ''}
          onChange={(e) => onFilterChange('departmentId', e.target.value)}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept._id || dept.id} value={dept._id || dept.id}>
              {dept.name} ({dept.code})
            </option>
          ))}
        </select>

        {/* Employment Type Filter */}
        <select
          value={filters.employmentType || ''}
          onChange={(e) => onFilterChange('employmentType', e.target.value)}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
        >
          <option value="">All Employment Types</option>
          <option value="FULL_TIME">Full Time</option>
          <option value="PART_TIME">Part Time</option>
          <option value="CONTRACT">Contract</option>
          <option value="INTERN">Intern</option>
        </select>

        {/* Start Date */}
        <input
          type="date"
          title="Filter by Start Date"
          value={filters.startDate || ''}
          onChange={(e) => onFilterChange('startDate', e.target.value)}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
        <span className="text-slate-500 font-mono">
          Filters applied: {Object.values(filters).filter(Boolean).length} active
        </span>

        <button
          onClick={onResetFilters}
          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Filters
        </button>
      </div>
    </div>
  );
}
