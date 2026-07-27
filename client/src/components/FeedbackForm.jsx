import React, { useState } from 'react';

export default function FeedbackForm({ employeeId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    category: 'WORK_ENVIRONMENT',
    feedbackText: '',
    anonymous: false,
    visibility: 'HR_ONLY'
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, employeeId, feedbackDate: new Date().toISOString() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 p-6 rounded-3xl border border-slate-800">
      <h2 className="text-xl font-bold text-slate-100">Submit Feedback</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="MANAGEMENT">Management</option>
            <option value="WORK_ENVIRONMENT">Work Environment</option>
            <option value="COMPENSATION">Compensation</option>
            <option value="BENEFITS">Benefits</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Feedback Visibility</label>
          <select
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="HR_ONLY">HR Only</option>
            <option value="MANAGER">Manager & HR</option>
            <option value="PUBLIC">Public</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Feedback Details</label>
          <textarea
            name="feedbackText"
            required
            rows={5}
            value={formData.feedbackText}
            onChange={handleChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Please provide your feedback here..."
          />
        </div>

        <label className="flex items-center gap-3 bg-slate-950 p-4 border border-slate-800 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            name="anonymous"
            checked={formData.anonymous}
            onChange={handleChange}
            className="w-4 h-4 rounded text-indigo-500 bg-slate-800 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900"
          />
          <div>
            <div className="text-sm font-semibold text-slate-200">Submit Anonymously</div>
            <div className="text-xs text-slate-500">Your name will not be attached to this feedback.</div>
          </div>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl">Submit Feedback</button>
      </div>
    </form>
  );
}
