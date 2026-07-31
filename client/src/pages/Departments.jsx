import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DepartmentFormModal from '../components/DepartmentFormModal';
import DepartmentBulkUploadModal from '../components/DepartmentBulkUploadModal';
import {
  clearDepartmentError,
  clearDepartmentSuccess,
  createDepartment,
  deleteAllDepartments,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
  bulkUploadDepartments,
} from '../store/slices/departmentSlice';

export default function Departments() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { departments, loading, error, successMessage } = useSelector((state) => state.department);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [deleteConfirmDept, setDeleteConfirmDept] = useState(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  useEffect(() => {
    dispatch(fetchDepartments({ q: searchTerm }));
  }, [dispatch, searchTerm]);

  const handleOpenCreateModal = () => {
    setSelectedDept(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dept) => {
    setSelectedDept(dept);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    if (selectedDept) {
      const id = selectedDept._id || selectedDept.id;
      await dispatch(updateDepartment({ id, data: formData }));
    } else {
      await dispatch(createDepartment(formData));
    }
    setIsModalOpen(false);
    dispatch(fetchDepartments());
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmDept) return;
    const id = deleteConfirmDept._id || deleteConfirmDept.id;
    await dispatch(deleteDepartment(id));
    setDeleteConfirmDept(null);
    dispatch(fetchDepartments());
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirmText !== 'DELETE ALL') return;
    await dispatch(deleteAllDepartments());
    setIsDeleteAllOpen(false);
    setDeleteAllConfirmText('');
    dispatch(fetchDepartments({ q: searchTerm }));
  };

  const handleBulkUploadSubmit = async (formData) => {
    await dispatch(bulkUploadDepartments(formData));
    setIsBulkModalOpen(false);
    dispatch(fetchDepartments());
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest mb-1">
            <span>Organizational Structure</span>
            <span>•</span>
            <span>{departments.length} Active Departments</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100">Department Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage company divisions, assign department leaders, and monitor staffing density.
          </p>
        </div>

        {canManage && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-2xl transition-all transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Bulk Upload
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Department
            </button>
            <button
              onClick={() => setIsDeleteAllOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete All
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm">
          <span>{successMessage}</span>
          <button onClick={() => dispatch(clearDepartmentSuccess())} className="text-emerald-400 hover:text-emerald-300 font-bold">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
          <span>{error}</span>
          <button onClick={() => dispatch(clearDepartmentError())} className="text-rose-400 hover:text-rose-300 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <svg
            className="w-5 h-5 absolute left-3.5 top-3 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search department name, code, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Department Cards Grid */}
      {loading && departments.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : departments.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1m-1-4h.01M9 16h.01M9 12h.01M13 16h.01M13 12h.01" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-200">No departments found</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
            Get started by creating your company&apos;s first department using the button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const manager = dept.managerId;
            return (
              <div
                key={dept._id || dept.id}
                className="group relative flex flex-col justify-between p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-violet-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-lg font-mono shadow-inner">
                        {dept.code}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {dept.name}
                        </h3>
                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {dept.location || 'HQ Location'}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                      {dept.employeeCount || 0} Staff
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 min-h-[2.5rem] mb-4">
                    {dept.description || 'No description provided for this organizational unit.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                      {manager ? manager.firstName?.[0] : '?'}
                    </div>
                    <div className="text-xs">
                      <div className="text-slate-300 font-semibold">
                        {manager ? `${manager.firstName} ${manager.lastName}` : 'Unassigned'}
                      </div>
                      <div className="text-slate-500 font-mono">Department Manager</div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(dept)}
                        title="Edit Department"
                        className="p-2 text-slate-400 hover:text-indigo-300 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmDept(dept)}
                        title="Delete Department"
                        className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create & Edit Modal */}
      <DepartmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        department={selectedDept}
        onSubmit={handleFormSubmit}
        loading={loading}
      />

      {/* Bulk Upload Modal */}
      <DepartmentBulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSubmit={handleBulkUploadSubmit}
        loading={loading}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-100">Delete Department</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <span className="text-slate-200 font-bold">{deleteConfirmDept.name}</span>?
                This operation will fail if employees are actively assigned.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmDept(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal — typed confirmation required given the blast radius */}
      {isDeleteAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-100">Delete All Departments</h3>
              <p className="text-xs text-slate-400 mt-1">
                This will permanently delete <span className="text-slate-200 font-bold">all {departments.length} department(s)</span>.
                Departments that still have active employees assigned will be skipped and reported, not force-deleted.
                This cannot be undone for departments that are deleted.
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Type <span className="font-mono font-bold text-rose-400">DELETE ALL</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteAllConfirmText}
                onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                placeholder="DELETE ALL"
                className="mt-3 w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-center font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setIsDeleteAllOpen(false); setDeleteAllConfirmText(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllConfirmText !== 'DELETE ALL' || loading}
                className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-rose-600/25"
              >
                {loading ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
