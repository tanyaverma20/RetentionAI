import React, { useState } from 'react';

export default function SurveyForm({ employeeId, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    engagementScore: 3,
    jobSatisfaction: 3,
    workLifeBalance: 3,
    stressLevel: 3,
    careerGrowthScore: 3,
    managerRelationshipScore: 3,
    learningOpportunities: 3,
    recognition: 3,
    compensationSatisfaction: 3,
    overallHappiness: 3,
    surveyComments: ''
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'range' ? Number(value) : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, employeeId, surveyDate: new Date().toISOString() });
  };

  const Slider = ({ name, label }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-semibold text-slate-600">
        <label>{label}</label>
        <span>{formData[name]}/5</span>
      </div>
      <input
        type="range"
        name={name}
        min="1"
        max="5"
        step="1"
        value={formData[name]}
        onChange={handleChange}
        className="w-full accent-indigo-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400 uppercase">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-3xl border border-slate-100">
      <h2 className="text-xl font-bold text-slate-900">Submit Engagement Survey</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Slider name="engagementScore" label="Engagement Score" />
        <Slider name="jobSatisfaction" label="Job Satisfaction" />
        <Slider name="workLifeBalance" label="Work-Life Balance" />
        <Slider name="stressLevel" label="Stress Level" />
        <Slider name="careerGrowthScore" label="Career Growth Score" />
        <Slider name="managerRelationshipScore" label="Manager Relationship" />
        <Slider name="learningOpportunities" label="Learning Opportunities" />
        <Slider name="recognition" label="Recognition" />
        <Slider name="compensationSatisfaction" label="Compensation Satisfaction" />
        <Slider name="overallHappiness" label="Overall Happiness" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Additional Comments</label>
        <textarea
          name="surveyComments"
          rows={4}
          value={formData.surveyComments}
          onChange={handleChange}
          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Any specific feedback or concerns?"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl">Submit Survey</button>
      </div>
    </form>
  );
}
