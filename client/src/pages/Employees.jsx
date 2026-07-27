import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import BulkImportModal from '../components/BulkImportModal';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { fetchDepartments } from '../store/slices/departmentSlice';
import {
  bulkImportEmployees,
  clearEmployeeError,
  clearEmployeeSuccess,
  createEmployee,
  fetchEmployees,
  predictBatchEmployees,
  resetFilters,
  restoreEmployee,
  setFilter,
  setPage,
  softDeleteEmployee,
  updateEmployee,
} from '../store/slices/employeeSlice';
import { bulkImportHrRecords } from '../store/slices/hrSlice';

const RISK_STYLES = {
  HIGH: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  LOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function RiskBadge({ riskLevel, probability }) {
  if (!riskLevel) return <span className="text-xs text-slate-600 italic">No Data</span>;
  const style = RISK_STYLES[riskLevel] || 'bg-slate-700/30 text-slate-500';
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${style}`}>
        {riskLevel}
      </span>
      {probability !== undefined && (
        <span className="text-xs font-mono text-slate-400">{(probability * 100).toFixed(0)}%</span>
      )}
    </div>
  );
}

export default function Employees() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);
  const { departments } = useSelector((state) => state.department);
  const {
    employees,
    totalItems,
    page,
    limit,
    totalPages,
    filters,
    loading,
    error,
    successMessage,
    importSummary,
  } = useSelector((state) => state.employee);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState(null);
  const [riskFilter, setRiskFilter] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  useEffect(() => {
    dispatch(fetchDepartments());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      fetchEmployees({
        page,
        limit,
        search: filters.search,
        departmentId: filters.departmentId,
        designation: filters.designation,
        status: filters.status,
        includeDeleted: filters.includeDeleted,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }),
    );
  }, [dispatch, page, limit, filters]);

  const handleSearchChange = (e) => {
    dispatch(setFilter({ search: e.target.value }));
  };

  const handleFilterChange = (field, value) => {
    dispatch(setFilter({ [field]: value }));
  };

  const handleFormSubmit = async (formData) => {
    if (selectedEmployee) {
      const id = selectedEmployee._id || selectedEmployee.id;
      await dispatch(updateEmployee({ id, data: formData }));
    } else {
      await dispatch(createEmployee(formData));
    }
    setIsFormModalOpen(false);
    dispatch(
      fetchEmployees({
        page,
        limit,
        search: filters.search,
        departmentId: filters.departmentId,
        designation: filters.designation,
        status: filters.status,
        includeDeleted: filters.includeDeleted,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }),
    );
  };

  const handleSoftDelete = async () => {
    if (!deleteConfirmEmp) return;
    const id = deleteConfirmEmp._id || deleteConfirmEmp.id;
    await dispatch(softDeleteEmployee(id));
    setDeleteConfirmEmp(null);
  };

  const handleRestore = async (emp) => {
    const id = emp._id || emp.id;
    await dispatch(restoreEmployee(id));
  };

  const handleBulkImportSubmit = async (payload) => {
    if (payload.collection === 'employees') {
      await dispatch(bulkImportEmployees({ csvText: payload.csvText }));
      dispatch(fetchEmployees({
        page: 1, limit, search: '', departmentId: '', designation: '', status: '', includeDeleted: false,
      }));
    } else {
      await dispatch(bulkImportHrRecords({ collection: payload.collection, csvText: payload.csvText }));
    }
  };

  const getStatusBadge = (status, isDeleted) => {
    if (isDeleted) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'INACTIVE':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'ON_LEAVE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'TERMINATED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest mb-1">
            <span>Workforce Directory</span>
            <span>•</span>
            <span>{totalItems} Total Records</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100">Employee Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, manage profiles, and bulk import workforce data across departments.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={async () => {
                await dispatch(predictBatchEmployees({}));
                dispatch(fetchEmployees({ page, limit, search: filters.search, departmentId: filters.departmentId, designation: filters.designation, status: filters.status, includeDeleted: filters.includeDeleted, sortBy: filters.sortBy, sortOrder: filters.sortOrder }));
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 border border-violet-500/30 rounded-2xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              {loading ? 'Running AI…' : 'Run AI Prediction'}
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all"
            >
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Bulk Import CSV
            </button>
            <button
              onClick={() => { setSelectedEmployee(null); setIsFormModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm">
          <span>{successMessage}</span>
          <button onClick={() => dispatch(clearEmployeeSuccess())} className="text-emerald-400 hover:text-emerald-300 font-bold">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          <span>{error}</span>
          <button onClick={() => dispatch(clearEmployeeError())} className="text-rose-400 hover:text-rose-300 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-4 backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
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
              placeholder="Search name, code, email, designation..."
              value={filters.search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-xs placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Department Filter */}
          <select
            value={filters.departmentId}
            onChange={(e) => handleFilterChange('departmentId', e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id || dept.id} value={dept._id || dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
          </select>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
          >
            <option value="">All Risk Levels</option>
            <option value="HIGH">🔴 High Risk</option>
            <option value="MEDIUM">🟡 Medium Risk</option>
            <option value="LOW">🟢 Low Risk</option>
          </select>

          {/* Sorting Field */}
          <div className="flex items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-200 text-xs focus:outline-none"
            >
              <option value="createdAt">Date Created</option>
              <option value="joiningDate">Joining Date</option>
              <option value="firstName">First Name</option>
              <option value="lastName">Last Name</option>
              <option value="salary">Salary</option>
              <option value="employeeCode">Employee Code</option>
            </select>
            <button
              onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-colors"
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeDeleted}
                onChange={(e) => handleFilterChange('includeDeleted', e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              Show Soft-Deleted Employees
            </label>
          </div>

          <button
            onClick={() => dispatch(resetFilters())}
            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Employees Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-200">No employees match criteria</h3>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search terms or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Department &amp; Role</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Joining Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">AI Risk</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees
                  .filter(emp => !riskFilter || emp.latestPrediction?.riskLevel === riskFilter)
                  .map((emp) => {
                  const empId = emp._id || emp.id;
                  const dept = emp.departmentId;

                  return (
                    <tr
                      key={empId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        emp.isDeleted ? 'opacity-60 bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-indigo-900/50 border border-slate-700 flex items-center justify-center font-bold text-indigo-300">
                            {emp.firstName?.[0]}
                            {emp.lastName?.[0]}
                          </div>
                          <div>
                            <Link
                              to={`/employees/${empId}`}
                              className="font-semibold text-slate-100 hover:text-indigo-300 transition-colors"
                            >
                              {emp.firstName} {emp.lastName}
                            </Link>
                            <div className="text-xs font-mono text-indigo-400">{emp.employeeCode}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200">{emp.designation}</div>
                        <div className="text-xs text-slate-400">
                          {dept?.name ? `${dept.name} (${dept.code})` : 'Unassigned'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-slate-200">{emp.email}</div>
                        <div className="text-xs text-slate-500">{emp.phone || 'N/A'}</div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-mono font-semibold rounded-full border ${getStatusBadge(
                            emp.status,
                            emp.isDeleted,
                          )}`}
                        >
                          {emp.isDeleted ? 'DELETED' : emp.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <RiskBadge riskLevel={emp.latestPrediction?.riskLevel} probability={emp.latestPrediction?.riskScore} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/employees/${empId}`}
                            title="View Profile"
                            className="p-2 text-slate-400 hover:text-indigo-300 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>

                          {canManage && (
                            <>
                              {!emp.isDeleted ? (
                                <>
                                  <button
                                    onClick={() => { setSelectedEmployee(emp); setIsFormModalOpen(true); }}
                                    title="Edit Employee"
                                    className="p-2 text-slate-400 hover:text-indigo-300 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmEmp(emp)}
                                    title="Soft Delete Employee"
                                    className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRestore(emp)}
                                  title="Restore Employee"
                                  className="px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors"
                                >
                                  Restore
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing Page <span className="font-bold text-slate-200">{page}</span> of{' '}
              <span className="font-bold text-slate-200">{totalPages}</span> ({totalItems} records)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => dispatch(setPage(page - 1))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => dispatch(setPage(page + 1))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <EmployeeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        employee={selectedEmployee}
        departments={departments}
        managers={employees}
        onSubmit={handleFormSubmit}
        loading={loading}
      />

      {/* Bulk CSV Import Modal */}
      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleBulkImportSubmit}
        loading={loading}
        importSummary={importSummary}
      />

      {/* Soft Delete Confirmation Modal */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-100">Soft Delete Employee</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to soft delete <span className="text-slate-200 font-bold">{deleteConfirmEmp.firstName} {deleteConfirmEmp.lastName}</span>?
                The employee profile will be deactivated but retained for audit log compliance.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmEmp(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSoftDelete}
                className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25"
              >
                Soft Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
