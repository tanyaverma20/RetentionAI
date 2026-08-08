import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const GENDER_COLORS = ['#6366f1', '#ec4899', '#10b981', '#94a3b8'];
const DEPT_COLORS = ['#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl shadow-card text-xs font-sans">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="flex items-center gap-2 font-mono" style={{ color: entry.color || entry.fill }}>
            <span>{entry.name}:</span>
            <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function EmployeesByDepartmentChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Employees by Department</h3>
        <p className="text-xs text-slate-500">Headcount distribution across company divisions</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="code" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Employees" fill="#6366f1" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function EmployeesByGenderChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Employees by Gender</h3>
        <p className="text-xs text-slate-500">Gender diversity & inclusion breakdown</p>
      </div>
      <div className="h-64 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={5}
              dataKey="count"
              nameKey="label"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function EmployeesByEmploymentTypeChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Employment Type Distribution</h3>
        <p className="text-xs text-slate-500">Full-time, Part-time, Contract, and Intern breakdown</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis dataKey="label" type="category" stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Employees" fill="#818cf8" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GlobalFeatureImportanceChart({ data = [], narrative = '' }) {
  const sorted = [...data].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).slice(0, 10);
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Top Attrition Drivers</h3>
        <p className="text-xs text-slate-500">Most influential features ranked by mean |SHAP| across the workforce</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 10, right: 16, left: 20, bottom: 0 }}>
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis dataKey="displayName" type="category" width={130} stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="meanAbsShap" name="Mean |SHAP|" fill="#f59e0b" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {narrative && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-slate-800 leading-relaxed">
          {narrative}
        </div>
      )}
    </div>
  );
}

export function MonthlyHiringTrendChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Monthly Hiring Trend</h3>
        <p className="text-xs text-slate-500">Employee onboardings over the past 12 months</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="hiringGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="hires" name="New Hires" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#hiringGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonthlyAttritionTrendChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Monthly Attrition Trend</h3>
          <p className="text-xs text-slate-500">Departure benchmark (Placeholder for future ML model outputs)</p>
        </div>
        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 rounded-full">
          Placeholder ML
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="attrition" name="Attrition" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#f43f5e', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ExperienceDistributionChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Employee Experience Distribution</h3>
        <p className="text-xs text-slate-500">Tenure breakdown by years of service</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Employees" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PerformanceDistributionChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Performance Distribution</h3>
        <p className="text-xs text-slate-500">Employee performance rating breakdown</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="rating" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Count" fill="#eab308" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AgeDistributionChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Age Distribution</h3>
        <p className="text-xs text-slate-500">Generational diversity breakdown</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LeaveStatisticsChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Leave Statistics</h3>
        <p className="text-xs text-slate-500">Breakdown of leave types</p>
      </div>
      <div className="h-64 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="type">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AdvancedTrendsChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">HR Operations Trend</h3>
        <p className="text-xs text-slate-500">Attendance, Training, and Promotion correlation over time</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avgAttendanceHours" name="Avg Attendance Hrs" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="trainingCompletions" name="Training Completions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="promotions" name="Promotions" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Employee Intelligence (NLP) charts ────────────────────────────────────

const SENTIMENT_COLORS = { Positive: '#10b981', Neutral: '#94a3b8', Negative: '#f43f5e' };
const BURNOUT_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#f43f5e' };
const EMOTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#64748b'];

export function SentimentDistributionChart({ data = {} }) {
  const chartData = Object.entries(data).map(([label, count]) => ({ label, count }));
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Sentiment Distribution</h3>
        <p className="text-xs text-slate-500">Employee feedback/survey sentiment across the workforce</p>
      </div>
      <div className="h-64 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="label">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.label] || '#64748b'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BurnoutDistributionChart({ data = {} }) {
  const chartData = ['Low', 'Medium', 'High'].map((label) => ({ label, count: data[label] || 0 }));
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Burnout Distribution</h3>
        <p className="text-xs text-slate-500">Employees by burnout-risk category</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Employees" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={BURNOUT_COLORS[entry.label]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function EmotionDistributionChart({ data = {} }) {
  const chartData = Object.entries(data)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Emotion Distribution</h3>
        <p className="text-xs text-slate-500">Dominant emotion across analyzed employees</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Employees" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={EMOTION_COLORS[index % EMOTION_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TopicFrequencyChart({ data = [], title = 'Top Employee Concerns', subtitle = 'Most frequently mentioned topics' }) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={{ top: 10, right: 16, left: 20, bottom: 0 }}>
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis dataKey="topic" type="category" width={110} stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Mentions" fill="#a855f7" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SentimentBurnoutTrendChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Sentiment &amp; Burnout Trend</h3>
        <p className="text-xs text-slate-500">Monthly average sentiment score and burnout score over time</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="period" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 1]} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avgSentimentScore" name="Avg Sentiment" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="avgBurnoutScore" name="Avg Burnout" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Decision Intelligence (AI Recommendations) charts ─────────────────────

const RECOMMENDATION_TYPE_LABELS = {
  IMMEDIATE_INTERVENTION: 'Immediate Intervention',
  RETENTION_MEETING: 'Retention Meeting',
  PERFORMANCE_IMPROVEMENT_PLAN: 'Performance Improvement Plan',
  MONITOR_WEEKLY: 'Monitor Weekly',
  CAREER_DISCUSSION: 'Career Discussion',
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

const RECOMMENDATION_COLORS = ['#d946ef', '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16', '#64748b'];

export function RecommendationDistributionChart({ data = {} }) {
  const chartData = Object.entries(data)
    .map(([type, count]) => ({ type: RECOMMENDATION_TYPE_LABELS[type] || type, count }))
    .sort((a, b) => b.count - a.count);
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Recommendation Distribution</h3>
        <p className="text-xs text-slate-500">Current AI recommendations by category (latest per employee)</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 16, left: 20, bottom: 0 }}>
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis dataKey="type" type="category" width={140} stroke="#64748b" tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Employees" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={RECOMMENDATION_COLORS[index % RECOMMENDATION_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RecommendationTrendsChart({ data = [] }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-card flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Recommendation Trends</h3>
        <p className="text-xs text-slate-500">Decisions generated per month</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="period" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="count" name="Decisions" stroke="#d946ef" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export { RECOMMENDATION_TYPE_LABELS };
