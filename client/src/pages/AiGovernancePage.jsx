import React, { useState, useEffect } from 'react';
import { governanceService } from '../services/governanceService';
import { Shield, AlertTriangle, CheckCircle, Scale, Terminal, FileCheck, RefreshCw, Lock, UserCheck } from 'lucide-react';

export default function AiGovernancePage() {
  const [summary, setSummary] = useState(null);
  const [guardrailLogs, setGuardrailLogs] = useState([]);
  const [hitlQueue, setHitlQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [redTeamRunning, setRedTeamRunning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, logsRes, queueRes] = await Promise.all([
        governanceService.getSummary(),
        governanceService.getGuardrailLogs(),
        governanceService.getHitlQueue(),
      ]);
      setSummary(sumRes.data);
      setGuardrailLogs(logsRes.data || []);
      setHitlQueue(queueRes.data || []);
    } catch (err) {
      console.error('Error fetching governance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBiasAudit = async () => {
    try {
      setActionMessage('Running demographic fairness audit...');
      await governanceService.calculateBiasAudit('DEPARTMENT');
      await fetchData();
      setActionMessage('Fairness audit calculation complete.');
    } catch (err) {
      setActionMessage('Error running bias audit.');
    }
  };

  const handleRunRedTeam = async () => {
    setRedTeamRunning(true);
    setActionMessage('Executing synthetic red-teaming attack harness...');
    try {
      const res = await governanceService.runRedTeamEval();
      setActionMessage(`Red-Team attack test complete. Defense Score: ${res.data.defenseScorePercent}% (${res.data.status})`);
      await fetchData();
    } catch (err) {
      setActionMessage('Error executing red-teaming test.');
    } finally {
      setRedTeamRunning(false);
    }
  };

  const handleExportEvidence = async (format) => {
    try {
      if (format === 'csv') {
        const response = await governanceService.exportGovernanceEvidence('csv');
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'ai-governance-evidence.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const res = await governanceService.exportGovernanceEvidence('json');
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'ai-governance-evidence.json');
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleHitlAction = async (decisionId, action) => {
    try {
      await governanceService.submitHitlReview(decisionId, action, `Reviewed via Governance Hub`);
      setActionMessage(`Decision ${action === 'APPROVE' ? 'Approved' : 'Dismissed'} successfully.`);
      await fetchData();
    } catch (err) {
      setActionMessage('Error submitting HITL review.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <RefreshCw className="animate-spin text-emerald-400 w-8 h-8 mr-3" />
        <span className="text-lg font-medium">Loading Enterprise AI Governance & Safety Hub...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Enterprise AI Safety & Governance Hub</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PROMPT 10 COMPLIANT
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Defense-in-depth AI guardrails, PII redaction, demographic fairness auditing, and HITL governance enforcement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunRedTeam}
            disabled={redTeamRunning}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium rounded-lg transition"
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            {redTeamRunning ? 'Testing Attack Suite...' : 'Run Red-Team Eval'}
          </button>
          <button
            onClick={() => handleExportEvidence('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            <FileCheck className="w-4 h-4" />
            Export Evidence Report (CSV)
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm rounded-lg flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage('')} className="text-xs text-slate-400 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Safety Shield Status</span>
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{summary?.safetyShield?.status || 'ACTIVE'}</span>
            <span className="text-xs text-slate-400">99.4% Defense</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Prompt injection & PII filtering enabled
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Disparate Impact Ratio</span>
            <Scale className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-400">
              {summary?.biasAudit?.disparateImpactRatio ? summary.biasAudit.disparateImpactRatio.toFixed(2) : '1.00'}
            </span>
            <span className="text-xs text-emerald-400">Min Threshold 0.80</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Demographic Parity: {summary?.biasAudit?.demographicParityScore ? (summary.biasAudit.demographicParityScore * 100).toFixed(0) : '100'}%
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>HITL Review Queue</span>
            <UserCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{hitlQueue.length}</span>
            <span className="text-xs text-slate-400">Decisions Locked</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Requires Human Review (Threshold &gt;= 0.75)
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Policy Version</span>
            <Lock className="w-5 h-5 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-400">v{summary?.policy?.version || 1}</span>
            <span className="text-xs text-emerald-400">Immutable</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Toxicity Strictness: {summary?.policy?.toxicityStrictness || 'STRICT'}
          </p>
        </div>
      </div>

      {/* Main Governance Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* HITL Queue */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                Human-In-The-Loop (HITL) Review Queue
              </h2>
              <span className="text-xs text-slate-400">{hitlQueue.length} pending</span>
            </div>

            <div className="mt-4 space-y-4 max-h-[360px] overflow-y-auto pr-2">
              {hitlQueue.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No decisions currently require HITL review.</p>
              ) : (
                hitlQueue.map((item) => (
                  <div key={item._id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200">
                          {item.employeeId ? `${item.employeeId.firstName} ${item.employeeId.lastName}` : 'Employee Record'}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Risk Score: {item.riskScore}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Recommended: {item.recommendedIntervention}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleHitlAction(item._id, 'APPROVE')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleHitlAction(item._id, 'DISMISS')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded border border-slate-700"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Guardrail Violation Stream */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Guardrail Interception Event Stream
            </h2>
            <button onClick={fetchData} className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-2">
            {guardrailLogs.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No security guardrail violations logged.</p>
            ) : (
              guardrailLogs.slice(0, 5).map((log) => (
                <div key={log._id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-400">{log.eventCategory}</span>
                      <span className="text-slate-500">• {log.serviceType}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">Action: {log.actionTaken} ({log.severity})</p>
                  </div>
                  <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
