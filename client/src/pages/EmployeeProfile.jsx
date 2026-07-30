import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { fetchDepartments } from '../store/slices/departmentSlice';
import { fetchEmployee360, fetchEmployeeTimeline, updateEmployee, uploadEmployeeAvatar } from '../store/slices/employeeSlice';
import { aiService } from '../services/aiService';
import { knowledgeService } from '../services/knowledgeService';
import { decisionService } from '../services/decisionService';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const TABS = ['Overview', 'Timeline', 'AI Insights', 'Attendance', 'Performance', 'Surveys', 'Feedback', 'Notes'];

const RECOMMENDATION_TYPE_LABELS = {
  RETENTION_PLAN: 'Retention Plan',
  PROMOTION_REVIEW: 'Promotion Review',
  COMPENSATION_REVIEW: 'Compensation Review',
  TRAINING_RECOMMENDATION: 'Training Recommendation',
  MENTORSHIP_ASSIGNMENT: 'Mentorship Assignment',
  MANAGER_INTERVENTION: 'Manager Intervention',
  CAREER_DEVELOPMENT: 'Career Development',
  RECOGNITION_PROGRAM: 'Recognition Program',
  WORKLOAD_ADJUSTMENT: 'Workload Adjustment',
  WELLBEING_SUPPORT: 'Well-being Support',
  ROLE_CHANGE_SUGGESTION: 'Role Change Suggestion',
  NO_ACTION_REQUIRED: 'No Action Required',
};

const PRIORITY_STYLES = {
  HIGH: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  LOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const STATUS_STYLES = {
  PENDING: 'bg-slate-700/30 text-slate-400 border-slate-600/40',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DISMISSED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  UNDER_REVIEW: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

function ScoreBar({ label, value, max = 5, color = 'indigo' }) {
  const pct = Math.round((value / max) * 100);
  const colors = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
  };
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-bold text-slate-200">{value}/{max}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.indigo}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="py-2.5 flex justify-between items-center border-b border-slate-800/60 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-200 text-right max-w-[60%] truncate">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, className = '' }) {
  return (
    <div className={`p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 ${className}`}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
        <span className="text-indigo-400">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Tab Content ─────────────────────────────────────────────────────────────
function TabOverview({ emp }) {
  const dept = emp.departmentId;
  const mgr = emp.managerId;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard title="Personal Information" icon="👤">
          <InfoRow label="Email" value={emp.email} />
          <InfoRow label="Phone" value={emp.phone} />
          <InfoRow label="Gender" value={emp.gender?.replace('_', ' ')} />
          <InfoRow label="Date of Birth" value={fmt(emp.dateOfBirth)} />
        </SectionCard>
        <SectionCard title="Organizational Placement" icon="🏢">
          <InfoRow label="Department" value={dept ? `${dept.name} (${dept.code})` : 'Unassigned'} />
          <InfoRow label="Direct Manager" value={mgr ? `${mgr.firstName} ${mgr.lastName}` : 'None'} />
          <InfoRow label="Joining Date" value={fmt(emp.joiningDate)} />
          <InfoRow label="Employment Type" value={emp.employmentType?.replace('_', ' ')} />
          <InfoRow label="Work Location" value={emp.workLocation} />
          <InfoRow label="Linked Account" value={emp.userId?.email} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard title="Address & Emergency" icon="📍">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Home Address</h3>
          <div className="text-sm text-slate-300 mb-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
            {emp.address?.street ? (
              <>
                <div>{emp.address.street}</div>
                <div>{emp.address.city}, {emp.address.state} {emp.address.zip}</div>
                <div>{emp.address.country}</div>
              </>
            ) : (
              <span className="text-slate-500 italic">No address provided.</span>
            )}
          </div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emergency Contact</h3>
          <div className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
            {emp.emergencyContact?.name ? (
              <>
                <div className="font-bold text-slate-200">{emp.emergencyContact.name} ({emp.emergencyContact.relation})</div>
                <div className="text-emerald-400 mt-1">📞 {emp.emergencyContact.phone}</div>
              </>
            ) : (
              <span className="text-slate-500 italic">No emergency contact provided.</span>
            )}
          </div>
        </SectionCard>
        
        <SectionCard title="Skills & Notes" icon="🎯">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Skills</h3>
          {emp.skills?.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {emp.skills.map((s, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">{s}</span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic mb-4">No skills listed.</div>
          )}
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Profile Notes</h3>
          <div className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800 min-h-[80px]">
            {emp.profileNotes || <span className="text-slate-500 italic">No notes.</span>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function TabTimeline({ timeline }) {
  if (!timeline?.length) return <p className="text-sm text-slate-500 text-center py-8">No timeline events found.</p>;

  const icons = {
    JOINED: '🎉',
    ATTENDANCE: '📅',
    PERFORMANCE: '📈',
    TRAINING: '🎓',
    PROMOTION: '⭐',
  };

  const colors = {
    JOINED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    ATTENDANCE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    PERFORMANCE: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    TRAINING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    PROMOTION: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
      {timeline.map((event, i) => (
        <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Marker */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-950 bg-slate-900 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">
            <span className="text-lg">{icons[event.type] || '📌'}</span>
          </div>
          {/* Card */}
          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${colors[event.type] || 'bg-slate-800 text-slate-400'}`}>
                {event.type}
              </span>
              <span className="text-xs font-mono text-slate-500">{fmt(event.date)}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-200">{event.title}</h3>
            {event.description && <p className="text-sm text-slate-400 mt-1 leading-relaxed">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TabAttendance({ records }) {
  if (!records?.length)
    return <p className="text-sm text-slate-500 text-center py-8">No attendance records found.</p>;

  const avg = (key) => Math.round(records.reduce((s, r) => s + (r[key] || 0), 0) / records.length);

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Avg Days Present', value: avg('totalHoursWorked') / 8, color: 'text-emerald-400' },
          { label: 'Avg Overtime Hrs', value: avg('overtimeHours'), color: 'text-amber-400' },
          { label: 'Records (6mo)', value: records.length, color: 'text-indigo-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <div className={`text-2xl font-black ${color}`}>{Math.round(value)}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>
      {/* Records */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase">
              <th className="py-2 pr-4 text-left">Month</th>
              <th className="py-2 pr-4 text-right">Status</th>
              <th className="py-2 pr-4 text-right">Hours</th>
              <th className="py-2 pr-4 text-right">Overtime</th>
              <th className="py-2 text-right">Mode</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 pr-4 font-mono text-slate-300">{fmt(r.attendanceDate)}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${r.attendanceStatus === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {r.attendanceStatus}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right text-slate-300">{r.totalHoursWorked}h</td>
                <td className="py-2.5 pr-4 text-right text-amber-400">{r.overtimeHours}h</td>
                <td className="py-2.5 text-right">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${r.workMode === 'REMOTE' ? 'bg-violet-500/10 text-violet-400' : 'bg-slate-800 text-slate-400'}`}>{r.workMode}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabPerformance({ records }) {
  if (!records?.length)
    return <p className="text-sm text-slate-500 text-center py-8">No performance reviews found.</p>;

  const latest = records[0];
  return (
    <div className="space-y-5">
      {/* Latest highlight */}
      <div className="p-5 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Latest Review — {latest.reviewPeriod}</p>
          <p className="text-3xl font-black text-indigo-300 mt-1">{latest.performanceScore}<span className="text-lg text-slate-500">/5</span></p>
          <p className="text-sm text-slate-400 mt-1">Goal Achievement: <span className="font-bold text-slate-200">{latest.goalAchievement}%</span></p>
        </div>
        {latest.promotionRecommendation && (
          <span className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
            🏆 Promotion Recommended
          </span>
        )}
      </div>
      {/* All reviews */}
      <div className="space-y-3">
        {records.map((r) => (
          <div key={r._id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">{r.reviewPeriod}</p>
              <p className="text-xs text-slate-500">Goal Achievement: {r.goalAchievement}%</p>
            </div>
            <div className="flex items-center gap-3">
              {r.promotionRecommendation && <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">Promoted</span>}
              <div className="text-right">
                <div className="text-xl font-black text-slate-200">{r.performanceScore}<span className="text-sm text-slate-600">/5</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabSurveys({ records }) {
  if (!records?.length)
    return <p className="text-sm text-slate-500 text-center py-8">No survey responses found.</p>;

  return (
    <div className="space-y-5">
      {records.map((s) => (
        <div key={s._id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">Survey — {fmt(s.surveyDate)}</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <ScoreBar label="Engagement Score" value={s.engagementScore} color="indigo" />
            <ScoreBar label="Job Satisfaction" value={s.jobSatisfaction} color="emerald" />
            <ScoreBar label="Work-Life Balance" value={s.workLifeBalance} color="amber" />
            <ScoreBar label="Career Growth" value={s.careerGrowthScore} color="violet" />
            <ScoreBar label="Manager Relationship" value={s.managerRelationshipScore} color="indigo" />
            <ScoreBar label="Stress Level (inverse)" value={s.stressLevel} color="rose" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabFeedback({ records }) {
  if (!records?.length)
    return <p className="text-sm text-slate-500 text-center py-8">No feedback records found.</p>;

  const catStyles = {
    MANAGEMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    WORK_ENVIRONMENT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    COMPENSATION: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    BENEFITS: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    OTHER: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  };
  return (
    <div className="space-y-3">
      {records.map((f) => {
        const style = catStyles[f.category] || catStyles.OTHER;
        return (
          <div key={f._id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${style}`}>{f.category?.replace('_', ' ')}</span>
              <span className="text-xs text-slate-500 font-mono">{fmt(f.feedbackDate)}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{f.feedbackText}</p>
          </div>
        );
      })}
    </div>
  );
}

function TabNotes({ records }) {
  if (!records?.length)
    return <p className="text-sm text-slate-500 text-center py-8">No manager notes found.</p>;

  return (
    <div className="space-y-3">
      {records.map((n) => (
        <div key={n._id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {n.performanceConcern && <span className="px-2 py-0.5 text-xs bg-rose-500/10 text-rose-400 rounded-full">⚠ Performance Concern</span>}
              {n.promotionDiscussion && <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 rounded-full">🏆 Promotion Discussion</span>}
              {n.followUpRequired && <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 rounded-full">📌 Follow-Up Required</span>}
            </div>
            <span className="text-xs text-slate-500 font-mono">{fmt(n.noteDate)}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{n.observation}</p>
          {n.recommendation && <p className="text-xs text-indigo-300 italic mt-1">→ {n.recommendation}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── SHAP Bar Chart ─────────────────────────────────────────────────────────
function ShapBar({ label, value, isPositive }) {
  const pct = Math.min(Math.abs(value) * 400, 100); // scale shap values visually
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs text-slate-400 truncate text-right shrink-0">{label}</div>
      <div className="flex-1 h-5 bg-slate-950 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isPositive ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`text-xs font-bold w-16 text-right ${isPositive ? 'text-rose-400' : 'text-emerald-400'}`}>
        {isPositive ? '+' : ''}{value.toFixed(4)}
      </div>
    </div>
  );
}

// ─── AI Insights Tab ────────────────────────────────────────────────────────
const RISK_COLORS = {
  HIGH: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
  MEDIUM: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  LOW: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
};

function TabAIInsights({
  prediction, explanation, intelligence, knowledgeInsights, decision,
  onGenerate, onExplain, onGenerateIntelligence, onLoadKnowledgeInsights, onGenerateDecision, onUpdateDecisionStatus,
  aiLoading, explainLoading, intelligenceLoading, knowledgeLoading, decisionLoading, decisionActionLoading,
  aiError, explainError, intelligenceError, knowledgeError, decisionError,
  canEdit,
}) {
  const rc = prediction ? (RISK_COLORS[prediction.riskLevel] || RISK_COLORS.LOW) : null;
  const allFactors = [
    ...(explanation?.topPositiveFactors || []).map(f => ({ ...f, isPositive: true })),
    ...(explanation?.topNegativeFactors || []).map(f => ({ ...f, isPositive: false })),
  ].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

  return (
    <div className="space-y-6 animate-fade-in">
      {aiError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{aiError}</div>
      )}

      {/* 1. AI Attrition Prediction Card */}
      {prediction ? (
        <SectionCard title="AI Attrition Prediction" icon="🧠" className={`${rc.border}`}>
          <div className={`flex items-center gap-6 p-5 rounded-2xl ${rc.bg} border ${rc.border} mb-5`}>
            <div className="text-center">
              <div className={`text-5xl font-black ${rc.text} drop-shadow-lg`}>
                {(prediction.riskScore * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Probability</div>
            </div>
            <div className="flex-1 space-y-1">
              <span className={`inline-block px-3 py-1 text-sm font-black uppercase tracking-widest rounded-full border ${rc.bg} ${rc.border} ${rc.text}`}>
                {prediction.riskLevel} RISK
              </span>
              <div className="text-xs text-slate-400 mt-1">Confidence: <span className="font-bold text-slate-200">{(prediction.confidence * 100).toFixed(1)}%</span></div>
              <div className="text-xs text-slate-400">Model: <span className="font-mono text-indigo-300">{prediction.modelVersion}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Prediction Date</div>
              <div className="text-sm font-bold text-slate-200">{new Date(prediction.predictedAt).toLocaleDateString()}</div>
            </div>
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</div>
              <div className="text-sm font-bold text-emerald-400">{prediction.status}</div>
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button onClick={onGenerate} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl transition-all disabled:opacity-50">
                <svg className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {aiLoading ? 'Refreshing…' : 'Refresh Prediction'}
              </button>
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard title="AI Attrition Prediction" icon="🧠" className="border-indigo-500/20">
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 text-3xl">🤖</div>
            <p className="text-slate-400 text-sm mb-5">No prediction generated for this employee yet.</p>
            {canEdit && (
              <button onClick={onGenerate} disabled={aiLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-600/25 transition-all disabled:opacity-50">
                <svg className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                {aiLoading ? 'Generating…' : 'Generate Prediction'}
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* 2. SHAP Explanation Card */}
      <SectionCard title="Why is this employee at risk?" icon="⚖️" className="border-amber-500/20">
        {explainError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{explainError}</div>
        )}
        {explanation ? (
          <div className="space-y-5">
            {/* Natural language summary */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-sm text-amber-100 leading-relaxed">
              {explanation.summary}
            </div>

            {/* Positive factors (risk drivers) */}
            {explanation.topPositiveFactors?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-3">🔺 Risk Drivers</h3>
                <div className="space-y-2">
                  {explanation.topPositiveFactors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl">
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{f.displayName}</div>
                        <div className="text-xs text-slate-500">{f.formattedValue}</div>
                      </div>
                      <div className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">+{(f.shapValue * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Negative factors (protective) */}
            {explanation.topNegativeFactors?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">🔻 Protective Factors</h3>
                <div className="space-y-2">
                  {explanation.topNegativeFactors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{f.displayName}</div>
                        <div className="text-xs text-slate-500">{f.formattedValue}</div>
                      </div>
                      <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">{(f.shapValue * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SHAP Importance Bar Chart */}
            {allFactors.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">📊 Feature Importance (SHAP)</h3>
                <div className="space-y-2 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                  {allFactors.slice(0, 8).map((f, i) => (
                    <ShapBar key={i} label={f.displayName} value={f.shapValue} isPositive={f.isPositive} />
                  ))}
                </div>
              </div>
            )}

            {/* Refresh explanation */}
            {canEdit && (
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button onClick={onExplain} disabled={explainLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all disabled:opacity-50">
                  <svg className={`w-4 h-4 ${explainLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {explainLoading ? 'Refreshing…' : 'Refresh Explanation'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-2xl">⚖️</div>
            <p className="text-slate-400 text-sm mb-4">No SHAP explanation generated yet.</p>
            {canEdit && (
              <button onClick={onExplain} disabled={explainLoading || !prediction}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg transition-all disabled:opacity-50">
                {explainLoading ? 'Generating…' : '⚖️ Explain This Prediction'}
              </button>
            )}
            {!prediction && <p className="text-xs text-slate-600 mt-2">Generate a prediction first.</p>}
          </div>
        )}
      </SectionCard>

      {/* 3. Employee Intelligence (NLP) Card */}
      <SectionCard title="Employee Intelligence" icon="🎭" className="border-violet-500/20">
        {intelligenceError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{intelligenceError}</div>
        )}
        {intelligence ? (
          <div className="space-y-5">
            <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl text-sm text-violet-100 leading-relaxed">
              {intelligence.summary}
            </div>

            {intelligence.dataPoints === 0 ? (
              <p className="text-xs text-slate-500 italic">No feedback, survey, or manager-note text found for this employee yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sentiment</div>
                  <div className={`text-sm font-bold ${intelligence.sentiment === 'Positive' ? 'text-emerald-400' : intelligence.sentiment === 'Negative' ? 'text-rose-400' : 'text-slate-300'}`}>
                    {intelligence.sentiment}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Dominant Emotion</div>
                  <div className="text-sm font-bold text-slate-200">{intelligence.emotion}</div>
                </div>
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Burnout Risk</div>
                  <div className={`text-sm font-bold ${intelligence.burnoutRisk === 'High' ? 'text-rose-400' : intelligence.burnoutRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {intelligence.burnoutRisk}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Confidence</div>
                  <div className="text-sm font-bold text-slate-200">{((intelligence.confidence || 0) * 100).toFixed(0)}%</div>
                </div>
              </div>
            )}

            {intelligence.topics?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">Top Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {intelligence.topics.map((topic, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full">{topic}</span>
                  ))}
                </div>
              </div>
            )}

            {intelligence.keywords?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Frequently Mentioned Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {intelligence.keywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs font-mono text-slate-300 bg-slate-800/60 border border-slate-700 rounded-full">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button onClick={() => onGenerateIntelligence(true)} disabled={intelligenceLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl transition-all disabled:opacity-50">
                  {intelligenceLoading ? 'Refreshing…' : 'Refresh Employee Intelligence'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 text-2xl">🎭</div>
            <p className="text-slate-400 text-sm mb-4">No Employee Intelligence profile generated yet.</p>
            {canEdit && (
              <button onClick={() => onGenerateIntelligence(false)} disabled={intelligenceLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg transition-all disabled:opacity-50">
                {intelligenceLoading ? 'Analyzing…' : '🎭 Analyze Employee Sentiment'}
              </button>
            )}
          </div>
        )}
      </SectionCard>

      {/* 4. Knowledge Insights (RAG) Card */}
      <SectionCard title="Knowledge Insights" icon="📚" className="border-sky-500/20">
        {knowledgeError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{knowledgeError}</div>
        )}
        {knowledgeInsights ? (
          <div className="space-y-4">
            {knowledgeInsights.insights.map((insight) => (
              <div key={insight.key} className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-2xl">
                <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2">{insight.label}</h3>
                <p className="text-sm text-slate-200 leading-relaxed mb-3">{insight.answer}</p>
                {insight.sourceDocuments?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {insight.sourceDocuments.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 text-[10px] font-mono text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-full" title={s.content}>
                        📄 {s.documentName}{s.pageNumber != null ? ` (p.${s.pageNumber})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button onClick={onLoadKnowledgeInsights} disabled={knowledgeLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-xl transition-all disabled:opacity-50">
                {knowledgeLoading ? 'Refreshing…' : 'Refresh Knowledge Insights'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-4 text-2xl">📚</div>
            <p className="text-slate-400 text-sm mb-4">No knowledge lookups run yet for this employee's role.</p>
            <button onClick={onLoadKnowledgeInsights} disabled={knowledgeLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-lg transition-all disabled:opacity-50">
              {knowledgeLoading ? 'Looking up…' : '📚 Load Knowledge Insights'}
            </button>
          </div>
        )}
      </SectionCard>

      {/* 5. AI Recommendations (Decision Engine) Card */}
      <SectionCard title="AI Recommendations" icon="🎯" className="border-fuchsia-500/20">
        {decisionError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs">{decisionError}</div>
        )}
        {decision ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 p-4 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-2xl">
              <span className="px-3 py-1.5 text-sm font-black uppercase tracking-widest rounded-full border bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30">
                {RECOMMENDATION_TYPE_LABELS[decision.recommendationType] || decision.recommendationType}
              </span>
              <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${PRIORITY_STYLES[decision.priority] || ''}`}>
                {decision.priority} Priority
              </span>
              <span className="px-2.5 py-1 text-xs font-mono text-slate-400 bg-slate-800/60 border border-slate-700 rounded-full">
                {((decision.confidence || 0) * 100).toFixed(0)}% confidence
              </span>
              <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${STATUS_STYLES[decision.status] || ''}`}>
                {decision.status}
              </span>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">{decision.reasoning}</p>

            {decision.affectedFactors?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2">Supporting Factors</h3>
                <div className="flex flex-wrap gap-2">
                  {decision.affectedFactors.map((f, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs text-slate-300 bg-slate-800/60 border border-slate-700 rounded-full">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {decision.relatedPolicies?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2">Related Policies</h3>
                <div className="flex flex-wrap gap-2">
                  {decision.relatedPolicies.map((p, i) => (
                    <span key={i} className="px-2.5 py-1 text-[10px] font-mono text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-full">📄 {p}</span>
                  ))}
                </div>
              </div>
            )}

            {decision.expectedOutcome && (
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Expected Benefit</h3>
                <p className="text-sm text-slate-300">{decision.expectedOutcome}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-500">
              <span>Review by {decision.reviewDate ? new Date(decision.reviewDate).toLocaleDateString() : '—'}</span>
              <span>Generated {new Date(decision.generatedAt).toLocaleString()}</span>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => onUpdateDecisionStatus('UNDER_REVIEW')} disabled={decisionActionLoading}
                  className="px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl disabled:opacity-50">
                  Mark Under Review
                </button>
                <button onClick={() => onUpdateDecisionStatus('DISMISSED')} disabled={decisionActionLoading}
                  className="px-3 py-2 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl disabled:opacity-50">
                  Dismiss
                </button>
                <button onClick={() => onUpdateDecisionStatus('ACCEPTED')} disabled={decisionActionLoading}
                  className="px-3 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl disabled:opacity-50">
                  Accept
                </button>
                <button onClick={() => onGenerateDecision(true)} disabled={decisionLoading}
                  className="px-4 py-2 text-xs font-semibold text-fuchsia-300 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 rounded-xl transition-all disabled:opacity-50">
                  {decisionLoading ? 'Refreshing…' : 'Refresh Recommendation'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mx-auto mb-4 text-2xl">🎯</div>
            <p className="text-slate-400 text-sm mb-4">No AI recommendation generated yet for this employee.</p>
            {canEdit && (
              <button onClick={() => onGenerateDecision(false)} disabled={decisionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-fuchsia-600 hover:bg-fuchsia-500 rounded-xl shadow-lg transition-all disabled:opacity-50">
                {decisionLoading ? 'Generating…' : '🎯 Generate Recommendation'}
              </button>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function EmployeeProfile() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [knowledgeInsights, setKnowledgeInsights] = useState(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [decision, setDecision] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionActionLoading, setDecisionActionLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [explainError, setExplainError] = useState('');
  const [intelligenceError, setIntelligenceError] = useState('');
  const [knowledgeError, setKnowledgeError] = useState('');
  const [decisionError, setDecisionError] = useState('');

  const { user } = useSelector((state) => state.auth);
  const { departments } = useSelector((state) => state.department);
  const { employee360, employeeTimeline, currentEmployee, loading, error } = useSelector((state) => state.employee);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  useEffect(() => {
    if (id) {
      dispatch(fetchEmployee360(id));
      dispatch(fetchEmployeeTimeline(id));
      dispatch(fetchDepartments());
      // Single merged AI request (Decision Intelligence sprint requirement:
      // "Employee Profile should require only one AI request") instead of
      // separately fetching prediction/explanation/intelligence/decision.
      aiService.getEmployeeAiInsights(id)
        .then((data) => {
          setPrediction(data?.prediction || null);
          setExplanation(data?.explanation || null);
          setIntelligence(data?.intelligence || null);
          setDecision(data?.decision || null);
        })
        .catch(() => {});
    }
  }, [dispatch, id]);

  const handleGenerate = useCallback(async () => {
    try {
      setAiLoading(true);
      setAiError('');
      const result = await aiService.explainSingle(id, false);
      // explainSingle calls predict+explain internally via FastAPI
      await aiService.predictSingle(id).then(setPrediction).catch(() => {});
      setExplanation(result);
    } catch (e) {
      setAiError(e?.response?.data?.error?.message || e?.message || 'Failed to generate a prediction. The AI service may be unavailable.');
    } finally { setAiLoading(false); }
  }, [id]);

  const handleExplain = useCallback(async (forceRefresh = false) => {
    try {
      setExplainLoading(true);
      setExplainError('');
      const result = await aiService.explainSingle(id, forceRefresh);
      setExplanation(result);
    } catch (e) {
      setExplainError(e?.response?.data?.error?.message || e?.message || 'Failed to generate an explanation. The AI service may be unavailable.');
    } finally { setExplainLoading(false); }
  }, [id]);
  const handleGenerateIntelligence = useCallback(async (forceRefresh = false) => {
    try {
      setIntelligenceLoading(true);
      setIntelligenceError('');
      const result = await aiService.generateEmployeeIntelligence(id, forceRefresh);
      setIntelligence(result);
    } catch (e) {
      setIntelligenceError(e?.response?.data?.error?.message || e?.message || 'Failed to analyze employee sentiment. The AI service may be unavailable.');
    } finally { setIntelligenceLoading(false); }
  }, [id]);

  const handleLoadKnowledgeInsights = useCallback(async () => {
    try {
      setKnowledgeLoading(true);
      setKnowledgeError('');
      const result = await knowledgeService.getEmployeeKnowledgeInsights(id);
      setKnowledgeInsights(result);
    } catch (e) {
      setKnowledgeError(e?.response?.data?.error?.message || e?.message || 'Failed to load knowledge insights. The knowledge base may be empty or unavailable.');
    } finally { setKnowledgeLoading(false); }
  }, [id]);

  const handleGenerateDecision = useCallback(async (forceRefresh = false) => {
    try {
      setDecisionLoading(true);
      setDecisionError('');
      const result = await decisionService.generateForEmployee(id, forceRefresh);
      setDecision(result);
    } catch (e) {
      setDecisionError(e?.response?.data?.error?.message || e?.message || 'Failed to generate a recommendation. The Decision Engine may be unavailable.');
    } finally { setDecisionLoading(false); }
  }, [id]);

  const handleUpdateDecisionStatus = useCallback(async (status) => {
    if (!decision?._id) return;
    try {
      setDecisionActionLoading(true);
      setDecisionError('');
      const result = await decisionService.updateStatus(decision._id, status);
      setDecision(result);
    } catch (e) {
      setDecisionError(e?.response?.data?.error?.message || e?.message || 'Failed to update recommendation status.');
    } finally { setDecisionActionLoading(false); }
  }, [decision]);

  const handleUpdate = async (formData) => {
    await dispatch(updateEmployee({ id, data: formData }));
    setIsEditModalOpen(false);
    dispatch(fetchEmployee360(id));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await dispatch(uploadEmployeeAvatar({ id, file }));
      dispatch(fetchEmployee360(id));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-400 animate-pulse">Loading 360° profile…</p>
      </div>
    );
  }

  if (error || !currentEmployee) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-slate-100">Unable to load profile</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">{error || 'Employee not found or access denied.'}</p>
        <Link to="/employees" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl">
          Return to Directory
        </Link>
      </div>
    );
  }

  const emp = currentEmployee;
  const dept = emp.departmentId;
  const { attendance = [], performance = [], surveys = [], feedback = [], managerNotes = [] } = employee360 || {};

  const riskLevel = prediction?.riskLevel || 'UNKNOWN';
  const riskStyles = {
    HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    UNKNOWN: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  const rs = riskStyles[riskLevel] || riskStyles.UNKNOWN;

  const avgPerf = performance.length ? performance.reduce((s, r) => s + r.performanceScore, 0) / performance.length : null;
  const avgEngagement = surveys.length ? surveys.reduce((s, r) => s + r.engagementScore, 0) / surveys.length : null;

  const tabContent = {
    Overview: <TabOverview emp={emp} />,
    Timeline: <TabTimeline timeline={employeeTimeline} />,
    'AI Insights': (
      <TabAIInsights
        prediction={prediction}
        explanation={explanation}
        intelligence={intelligence}
        knowledgeInsights={knowledgeInsights}
        decision={decision}
        onGenerate={handleGenerate}
        onExplain={() => handleExplain(true)}
        onGenerateIntelligence={handleGenerateIntelligence}
        onLoadKnowledgeInsights={handleLoadKnowledgeInsights}
        onGenerateDecision={handleGenerateDecision}
        onUpdateDecisionStatus={handleUpdateDecisionStatus}
        aiLoading={aiLoading}
        explainLoading={explainLoading}
        intelligenceLoading={intelligenceLoading}
        knowledgeLoading={knowledgeLoading}
        decisionLoading={decisionLoading}
        decisionActionLoading={decisionActionLoading}
        aiError={aiError}
        explainError={explainError}
        intelligenceError={intelligenceError}
        knowledgeError={knowledgeError}
        decisionError={decisionError}
        canEdit={canEdit}
      />
    ),
    Attendance: <TabAttendance records={attendance} />,
    Performance: <TabPerformance records={performance} />,
    Surveys: <TabSurveys records={surveys} />,
    Feedback: <TabFeedback records={feedback} />,
    Notes: <TabNotes records={managerNotes} />,
  };

  const tabCounts = {
    Attendance: attendance.length,
    Performance: performance.length,
    Surveys: surveys.length,
    Feedback: feedback.length,
    Notes: managerNotes.length,
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/employees')} className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Employees
        </button>
        {canEdit && (
          <button onClick={() => setIsEditModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit Profile
          </button>
        )}
      </div>

      {/* Hero Card */}
      <div className="relative overflow-hidden p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-violet-600/5 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0 group">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 border-2 border-indigo-400/30 flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-indigo-600/30 overflow-hidden relative">
                {emp.profilePicture ? (
                  <img src={`http://localhost:5000${emp.profilePicture}`} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`
                )}
                {canEdit && (
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <svg className="w-6 h-6 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Upload</span>
                    <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleAvatarUpload} />
                  </label>
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-extrabold text-slate-100">{emp.firstName} {emp.lastName}</h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full">{emp.employeeCode}</span>
              </div>
              <p className="text-base font-semibold text-slate-300">{emp.designation} · <span className="text-indigo-400">{dept?.name || 'No Dept'}</span></p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${rs}`}>
                  {prediction?.riskScore !== undefined ? `${(prediction.riskScore * 100).toFixed(0)}% Risk` : 'ML Loading...'}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${rs}`}>
                  {riskLevel}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700 rounded-full">{emp.status}</span>
                <span className="px-2.5 py-0.5 text-xs bg-slate-800 text-slate-400 border border-slate-700 rounded-full">📍 {emp.workLocation}</span>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-center">
              <div className="text-xl font-black text-emerald-400">{avgPerf ? avgPerf.toFixed(1) : '—'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Avg Performance</div>
            </div>
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-center">
              <div className="text-xl font-black text-indigo-400">{avgEngagement ? avgEngagement.toFixed(1) : '—'}</div>
              <div className="text-xs text-slate-500 mt-0.5">Avg Engagement</div>
            </div>
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-center">
              <div className="text-xl font-black text-violet-400">₹{((emp.salary || 0) / 100000).toFixed(1)}L</div>
              <div className="text-xs text-slate-500 mt-0.5">Annual CTC</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab}
            {tabCounts[tab] !== undefined && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab ? 'bg-white/20' : 'bg-slate-800 text-slate-500'}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">{tabContent[activeTab]}</div>

      {/* Edit Modal */}
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
