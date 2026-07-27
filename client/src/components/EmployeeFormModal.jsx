import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const employeeFormSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(2, 'Employee code must be at least 2 characters.')
    .max(30, 'Employee code must not exceed 30 characters.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: z.string().trim().email('Provide a valid email address.'),
  phone: z.string().trim().max(30).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).default('PREFER_NOT_TO_SAY'),
  dateOfBirth: z.string().optional().nullable(),
  departmentId: z.string().min(1, 'Department is required.'),
  designation: z.string().trim().min(1, 'Designation is required.').max(100),
  managerId: z.string().optional().nullable(),
  joiningDate: z.string().min(1, 'Joining date is required.'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  salary: z.coerce.number().min(0, 'Salary must be a positive number.').default(0),
  workLocation: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE']).default('ACTIVE'),
  address: z.object({
    street: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    zip: z.string().trim().max(20).optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    relation: z.string().trim().max(50).optional(),
  }).optional(),
  skills: z.string().trim().optional(), // Will split into array on submit
  profileNotes: z.string().trim().max(2000).optional(),
});

export default function EmployeeFormModal({
  isOpen,
  onClose,
  employee,
  departments = [],
  managers = [],
  onSubmit,
  loading = false,
}) {
  const isEditing = Boolean(employee);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: 'PREFER_NOT_TO_SAY',
      dateOfBirth: '',
      departmentId: '',
      designation: '',
      managerId: '',
      joiningDate: new Date().toISOString().split('T')[0],
      employmentType: 'FULL_TIME',
      salary: 0,
      workLocation: 'Office',
      status: 'ACTIVE',
      address: { street: '', city: '', state: '', country: '', zip: '' },
      emergencyContact: { name: '', phone: '', relation: '' },
      skills: '',
      profileNotes: '',
    },
  });

  useEffect(() => {
    if (employee) {
      reset({
        employeeCode: employee.employeeCode || '',
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        gender: employee.gender || 'PREFER_NOT_TO_SAY',
        dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
        departmentId: employee.departmentId?._id || employee.departmentId || '',
        designation: employee.designation || '',
        managerId: employee.managerId?._id || employee.managerId || '',
        joiningDate: employee.joiningDate
          ? new Date(employee.joiningDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        employmentType: employee.employmentType || 'FULL_TIME',
        salary: employee.salary || 0,
        workLocation: employee.workLocation || 'Office',
        status: employee.status || 'ACTIVE',
        address: {
          street: employee.address?.street || '',
          city: employee.address?.city || '',
          state: employee.address?.state || '',
          country: employee.address?.country || '',
          zip: employee.address?.zip || '',
        },
        emergencyContact: {
          name: employee.emergencyContact?.name || '',
          phone: employee.emergencyContact?.phone || '',
          relation: employee.emergencyContact?.relation || '',
        },
        skills: employee.skills ? employee.skills.join(', ') : '',
        profileNotes: employee.profileNotes || '',
      });
    } else {
      reset({
        employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: 'PREFER_NOT_TO_SAY',
        dateOfBirth: '',
        departmentId: departments[0]?._id || departments[0]?.id || '',
        designation: '',
        managerId: '',
        joiningDate: new Date().toISOString().split('T')[0],
        employmentType: 'FULL_TIME',
        salary: 0,
        workLocation: 'Office',
        status: 'ACTIVE',
        address: { street: '', city: '', state: '', country: '', zip: '' },
        emergencyContact: { name: '', phone: '', relation: '' },
        skills: '',
        profileNotes: '',
      });
    }
  }, [employee, reset, isOpen, departments]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-100">
            {isEditing ? 'Edit Employee Profile' : 'Add New Employee'}
          </h2>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit((data) => {
          const finalData = { ...data };
          if (finalData.skills) {
            finalData.skills = finalData.skills.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            finalData.skills = [];
          }
          onSubmit(finalData);
        })} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Row 1: Code & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Employee Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. EMP-001"
                {...register('employeeCode')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.employeeCode ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 uppercase placeholder-slate-500 text-sm focus:outline-none`}
              />
              {errors.employeeCode && <p className="mt-1 text-xs text-rose-400">{errors.employeeCode.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                placeholder="john.doe@company.com"
                {...register('email')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.email ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none`}
              />
              {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
            </div>
          </div>

          {/* Row 2: Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                First Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="John"
                {...register('firstName')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.firstName ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none`}
              />
              {errors.firstName && <p className="mt-1 text-xs text-rose-400">{errors.firstName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Last Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Doe"
                {...register('lastName')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.lastName ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none`}
              />
              {errors.lastName && <p className="mt-1 text-xs text-rose-400">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Row 3: Department & Designation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Department <span className="text-rose-400">*</span>
              </label>
              <select
                {...register('departmentId')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.departmentId ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 text-sm focus:outline-none`}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept._id || dept.id} value={dept._id || dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
              {errors.departmentId && <p className="mt-1 text-xs text-rose-400">{errors.departmentId.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Designation <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Senior Engineer"
                {...register('designation')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.designation ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none`}
              />
              {errors.designation && <p className="mt-1 text-xs text-rose-400">{errors.designation.message}</p>}
            </div>
          </div>

          {/* Row 4: Phone & Work Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+1 555 019 2831"
                {...register('phone')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Work Location
              </label>
              <input
                type="text"
                placeholder="New York Office / Remote"
                {...register('workLocation')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Row 5: Joining Date & Employment Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Joining Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                {...register('joiningDate')}
                className={`w-full px-3.5 py-2 bg-slate-950 border ${
                  errors.joiningDate ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                } rounded-xl text-slate-100 text-sm focus:outline-none`}
              />
              {errors.joiningDate && <p className="mt-1 text-xs text-rose-400">{errors.joiningDate.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Employment Type
              </label>
              <select
                {...register('employmentType')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Status
              </label>
              <select
                {...register('status')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          </div>

          {/* Row 6: Gender, DOB, Salary & Manager */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Gender
              </label>
              <select
                {...register('gender')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none"
              >
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                {...register('dateOfBirth')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Annual Salary ($)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="100000"
                {...register('salary')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Direct Manager
              </label>
              <select
                {...register('managerId')}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none"
              >
                <option value="">None</option>
                {managers
                  .filter((m) => !employee || (m._id || m.id) !== (employee._id || employee.id))
                  .map((mgr) => (
                    <option key={mgr._id || mgr.id} value={mgr._id || mgr.id}>
                      {mgr.firstName} {mgr.lastName} ({mgr.employeeCode})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 mt-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Address Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <input placeholder="Street Address" {...register('address.street')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              </div>
              <input placeholder="City" {...register('address.city')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              <input placeholder="State / Province" {...register('address.state')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Country" {...register('address.country')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
                <input placeholder="ZIP Code" {...register('address.zip')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 mt-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input placeholder="Full Name" {...register('emergencyContact.name')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              <input placeholder="Phone Number" {...register('emergencyContact.phone')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              <input placeholder="Relationship (e.g. Spouse)" {...register('emergencyContact.relation')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 mt-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Additional Info</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Skills (comma separated)</label>
                <input placeholder="e.g. React, Node.js, Project Management" {...register('skills')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Profile Notes / HR Comments</label>
                <textarea rows={3} placeholder="Add any private notes here..." {...register('profileNotes')} className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 text-sm"></textarea>
              </div>
            </div>
          </div>

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
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Employee' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
