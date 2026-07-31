import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const departmentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Department name must be at least 2 characters.')
    .max(100, 'Department name must not exceed 100 characters.'),
  code: z
    .string()
    .trim()
    .min(2, 'Department code must be at least 2 characters.')
    .max(20, 'Department code must not exceed 20 characters.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Code can only contain alphanumeric characters, hyphens, or underscores.'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters.').optional(),
  location: z.string().trim().max(100, 'Location cannot exceed 100 characters.').optional(),
  isActive: z.boolean().optional().default(true),
});

export default function DepartmentFormModal({ isOpen, onClose, department, onSubmit, loading = false }) {
  const isEditing = Boolean(department);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      location: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (department) {
      reset({
        name: department.name || '',
        code: department.code || '',
        description: department.description || '',
        location: department.location || '',
        isActive: department.isActive !== undefined ? department.isActive : true,
      });
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        location: '',
        isActive: true,
      });
    }
  }, [department, reset, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-100">
            {isEditing ? 'Edit Department' : 'Create New Department'}
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Department Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Engineering"
              {...register('name')}
              className={`w-full px-3.5 py-2.5 bg-slate-950 border ${
                errors.name ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none transition-colors`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Department Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. ENG"
              {...register('code')}
              className={`w-full px-3.5 py-2.5 bg-slate-950 border ${
                errors.code ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              } rounded-xl text-slate-100 uppercase placeholder-slate-500 text-sm focus:outline-none transition-colors`}
            />
            {errors.code && <p className="mt-1 text-xs text-rose-400">{errors.code.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Location
            </label>
            <input
              type="text"
              placeholder="e.g. Headquarters / Remote"
              {...register('location')}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Brief description of department scope..."
              {...register('description')}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              {...register('isActive')}
              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-300">
              Department is Active
            </label>
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
              {loading ? 'Saving...' : isEditing ? 'Update Department' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
