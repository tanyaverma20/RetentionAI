import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { fetchDepartments } from '../store/slices/departmentSlice';
import { fetchEmployee360, fetchEmployeeExplanation, fetchEmployeeTimeline, updateEmployee, uploadEmployeeAvatar } from '../store/slices/employeeSlice';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const TABS = ['Overview', 'Timeline', 'AI Insights', 'Attendance', 'Performance', 'Surveys', 'Feedback', 'Notes'];

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

// ─── AI Insights Tab ────────────────────────────────────────────────────────
function TabAIInsights({ explanation }) {
  if (!explanation)
    return <p className="text-sm text-slate-500 text-center py-8">No AI insights available.</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionCard title="Attrition Risk Summary" icon="🧠">
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{explanation.narrative}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Risk Score</div>
            <div className={`text-2xl font-black ${explanation.riskLevel === 'HIGH' ? 'text-rose-400' : explanation.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {(explanation.riskScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Risk Level</div>
            <div className={`text-xl font-black mt-1 ${explanation.riskLevel === 'HIGH' ? 'text-rose-400' : explanation.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {explanation.riskLevel}
            </div>
          </div>
          <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Confidence</div>
            <div className="text-xl font-black text-indigo-400 mt-1">
              {(explanation.confidence * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-center">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Base Value</div>
            <div className="text-xl font-black text-slate-400 mt-1">
              {(explanation.baseValue * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard title="Top Risk Factors (Increases Risk)" icon="⚠️" className="border-rose-500/20">
          {explanation.topPositiveContributors.length === 0 ? (
            <p className="text-sm text-slate-500">None identified.</p>
          ) : (
            <div className="space-y-3">
              {explanation.topPositiveContributors.map((c) => (
                <div key={c.featureKey} className="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{c.displayName}</div>
                    <div className="text-xs text-slate-400">{c.formattedValue}</div>
                  </div>
                  <div className="text-sm font-black text-rose-400">+{c.shapValue.toFixed(3)}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        
        <SectionCard title="Top Protective Factors (Reduces Risk)" icon="🛡️" className="border-emerald-500/20">
          {explanation.topNegativeContributors.length === 0 ? (
            <p className="text-sm text-slate-500">None identified.</p>
          ) : (
            <div className="space-y-3">
              {explanation.topNegativeContributors.map((c) => (
                <div key={c.featureKey} className="flex justify-between items-center p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{c.displayName}</div>
                    <div className="text-xs text-slate-400">{c.formattedValue}</div>
                  </div>
                  <div className="text-sm font-black text-emerald-400">{c.shapValue.toFixed(3)}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
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

  const { user } = useSelector((state) => state.auth);
  const { departments } = useSelector((state) => state.department);
  const { employee360, employeeExplanation, employeeTimeline, currentEmployee, loading, error } = useSelector((state) => state.employee);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  useEffect(() => {
    if (id) {
      dispatch(fetchEmployee360(id));
      dispatch(fetchEmployeeExplanation(id));
      dispatch(fetchEmployeeTimeline(id));
      dispatch(fetchDepartments());
    }
  }, [dispatch, id]);

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

  // Use real ML risk from explanation if available
  const riskLevel = employeeExplanation?.riskLevel || 'Pending';
  const riskScore = employeeExplanation?.riskScore;
  const riskStyles = {
    HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  const rs = riskStyles[riskLevel] || riskStyles.Pending;

  const avgPerf = performance.length ? performance.reduce((s, r) => s + r.performanceScore, 0) / performance.length : null;
  const avgEngagement = surveys.length ? surveys.reduce((s, r) => s + r.engagementScore, 0) / surveys.length : null;

  const tabContent = {
    Overview: <TabOverview emp={emp} />,
    Timeline: <TabTimeline timeline={employeeTimeline} />,
    'AI Insights': <TabAIInsights explanation={employeeExplanation} />,
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
                  emp.firstName?.[0]{emp.lastName?.[0]}
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
                  {riskScore !== undefined ? `${(riskScore * 100).toFixed(0)}% Risk` : 'ML Loading...'}
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
