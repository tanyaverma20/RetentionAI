import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { fetchDepartments } from '../store/slices/departmentSlice';
import {
  fetchEmployeeProfile,
  fetchEmployees,
  updateEmployee,
} from '../store/slices/employeeSlice';

export default function EmployeeProfile() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);
  const { departments } = useSelector((state) => state.department);
  const { currentEmployee, loading, error } = useSelector((state) => state.employee);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  useEffect(() => {
    if (id) {
      dispatch(fetchEmployeeProfile(id));
      dispatch(fetchDepartments());
    }
  }, [dispatch, id]);

  const handleUpdate = async (formData) => {
    await dispatch(updateEmployee({ id, data: formData }));
    setIsEditModalOpen(false);
    dispatch(fetchEmployeeProfile(id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !currentEmployee) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-100">Unable to load employee profile</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {error || 'The requested employee profile does not exist or you do not have authorization to view it.'}
        </p>
        <Link
          to="/employees"
          className="inline-block px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl"
        >
          Return to Employees Directory
        </Link>
      </div>
    );
  }

  const dept = currentEmployee.departmentId;
  const manager = currentEmployee.managerId;

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Employees
        </button>

        {canEdit && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </button>
        )}
      </div>

      {/* Main Profile Header Card */}
      <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 border-2 border-indigo-400/30 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-600/20">
            {currentEmployee.firstName?.[0]}
            {currentEmployee.lastName?.[0]}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-slate-100">
                {currentEmployee.firstName} {currentEmployee.lastName}
              </h1>
              <span className="px-3 py-1 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                {currentEmployee.employeeCode}
              </span>
            </div>

            <p className="text-base font-semibold text-slate-300 mt-0.5">
              {currentEmployee.designation} •{' '}
              <span className="text-indigo-400">{dept?.name || 'No Department'}</span>
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-full border ${
                  currentEmployee.isDeleted
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {currentEmployee.isDeleted ? 'DELETED' : currentEmployee.status}
              </span>

              <span className="px-2.5 py-1 text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                {currentEmployee.employmentType?.replace('_', ' ')}
              </span>

              <span className="text-xs text-slate-400 flex items-center gap-1">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {currentEmployee.workLocation || 'Office'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-right w-full md:w-auto">
          <div className="text-xs text-slate-500 font-mono uppercase">Compensation</div>
          <div className="text-2xl font-black text-slate-100">
            ${(currentEmployee.salary || 0).toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">/ yr</span>
          </div>
        </div>
      </div>

      {/* Grid of Profile Detail Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Personal Details */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Personal Information
          </h2>

          <div className="divide-y divide-slate-800/60 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Email Address</span>
              <span className="font-semibold text-slate-200">{currentEmployee.email}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Phone Number</span>
              <span className="font-semibold text-slate-200">{currentEmployee.phone || 'N/A'}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Gender</span>
              <span className="font-semibold text-slate-200">{currentEmployee.gender}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Date of Birth</span>
              <span className="font-mono text-slate-200">
                {currentEmployee.dateOfBirth
                  ? new Date(currentEmployee.dateOfBirth).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Organizational Details */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0h1m-1-4h.01M9 16h.01M9 12h.01M13 16h.01M13 12h.01" />
            </svg>
            Organizational Placement
          </h2>

          <div className="divide-y divide-slate-800/60 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Department</span>
              <span className="font-semibold text-slate-200">
                {dept ? `${dept.name} (${dept.code})` : 'Unassigned'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Direct Manager</span>
              <span className="font-semibold text-slate-200">
                {manager ? `${manager.firstName} ${manager.lastName}` : 'None Assigned'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Joining Date</span>
              <span className="font-mono text-slate-200">
                {currentEmployee.joiningDate
                  ? new Date(currentEmployee.joiningDate).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Linked User Account</span>
              <span className="font-mono text-xs text-slate-300">
                {currentEmployee.userId?.email || 'No Linked Account'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Modal */}
      <EmployeeFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        employee={currentEmployee}
        departments={departments}
        onSubmit={handleUpdate}
        loading={loading}
      />
    </div>
  );
}
