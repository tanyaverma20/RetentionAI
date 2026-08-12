import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function CustomerOpsCenter() {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [users, setUsers] = useState([]);
  const [usage, setUsage] = useState(null);
  const [imports, setImports] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  // Invite modal state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);

  useEffect(() => {
    fetchCenterData();
  }, []);

  async function fetchCenterData() {
    setLoading(true);
    try {
      const [settingsRes, onboardingRes, invRes, usageRes, impRes, usersRes, subRes, invcRes] = await Promise.allSettled([
        api.get('/organizations/settings'),
        api.get('/organizations/onboarding'),
        api.get('/invitations'),
        api.get('/usage/summary'),
        api.get('/imports/history'),
        api.get('/users'),
        api.get('/billing/subscription'),
        api.get('/billing/invoices'),
      ]);

      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data.data);
      if (onboardingRes.status === 'fulfilled') setOnboarding(onboardingRes.value.data.data);
      if (invRes.status === 'fulfilled') setInvitations(invRes.value.data.data || []);
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data.data);
      if (impRes.status === 'fulfilled') setImports(impRes.value.data.data || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data.data?.items || []);
      if (subRes.status === 'fulfilled') setSubscription(subRes.value.data.data);
      if (invcRes.status === 'fulfilled') setInvoices(invcRes.value.data.data?.invoices || []);
    } catch (err) {
      setActionMsg({ type: 'error', text: 'Failed to load Operations Center data.' });
    } finally {
      setLoading(false);
    }
  }

  async function handlePlanChange(newPlanCode) {
    try {
      const res = await api.patch('/billing/subscription/plan', { newPlanCode });
      setActionMsg({ type: 'success', text: `Plan successfully updated to ${newPlanCode}!` });
      fetchCenterData();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update plan.' });
    }
  }

  async function handleCancelSubscription() {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;
    try {
      await api.post('/billing/subscription/cancel');
      setActionMsg({ type: 'success', text: 'Subscription cancelled.' });
      fetchCenterData();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to cancel subscription.' });
    }
  }

  async function handleReactivateSubscription() {
    try {
      await api.post('/billing/subscription/reactivate');
      setActionMsg({ type: 'success', text: 'Subscription reactivated successfully!' });
      fetchCenterData();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to reactivate subscription.' });
    }
  }

  async function handleUpdateSettings(e) {
    e.preventDefault();
    try {
      const res = await api.patch('/organizations/settings', {
        industry: settings?.settings?.industry,
        timezone: settings?.settings?.timezone,
      });
      setSettings(res.data.data);
      setActionMsg({ type: 'success', text: 'Organization settings updated successfully.' });
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update settings.' });
    }
  }

  async function handleSendInvitation(e) {
    e.preventDefault();
    try {
      const res = await api.post('/invitations', { email: inviteEmail, roleId: inviteRoleId });
      setActionMsg({
        type: 'success',
        text: `Invitation sent! Raw token: ${res.data.data.invitationToken}`,
      });
      setInviteEmail('');
      const updatedInv = await api.get('/invitations');
      setInvitations(updatedInv.data.data || []);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to send invitation.' });
    }
  }

  async function handleRevokeInvitation(invId) {
    try {
      await api.delete(`/invitations/${invId}`);
      setActionMsg({ type: 'success', text: 'Invitation revoked.' });
      setInvitations(invitations.filter((i) => i.id !== invId));
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to revoke invitation.' });
    }
  }

  async function handlePreviewImport(e) {
    e.preventDefault();
    if (!importFile) return;
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await api.post('/imports/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewResult(res.data.data);
      setActionMsg({ type: 'success', text: 'Import file parsed and validated cleanly.' });
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Import preview failed.' });
    }
  }

  async function handleCommitImport(importId) {
    try {
      const res = await api.post(`/imports/${importId}/commit`);
      setActionMsg({ type: 'success', text: `Import committed! Added: ${res.data.data.newCount}, Updated: ${res.data.data.changedCount}` });
      setPreviewResult(null);
      fetchCenterData();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || 'Failed to commit import.' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Operations Center</h1>
            <p className="text-slate-400 text-sm mt-1">
              Multi-tenant enterprise organization administration, onboarding state, user invitations, and import governance.
            </p>
          </div>
          <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full text-xs font-semibold">
            Tenant: {settings?.name || 'Active Organization'} ({settings?.plan || 'FREE'} Plan)
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mt-6 border-b border-slate-800 pb-2">
          {['settings', 'users', 'imports', 'usage', 'billing'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab === 'settings'
                ? 'Org & Onboarding'
                : tab === 'users'
                ? 'Users & Invitations'
                : tab === 'imports'
                ? 'Data Import Hub'
                : tab === 'usage'
                ? 'Usage & Quotas'
                : 'Revenue & Subscriptions'}
            </button>
          ))}
        </div>
      </div>

      {actionMsg.text && (
        <div className={`p-4 rounded-xl text-sm ${actionMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* TAB 1: Settings & Onboarding */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Organization Profile</h2>
            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Company Name</label>
                <input type="text" value={settings?.name || ''} disabled className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Industry</label>
                <input
                  type="text"
                  value={settings?.settings?.industry || ''}
                  onChange={(e) => setSettings({ ...settings, settings: { ...settings.settings, industry: e.target.value } })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="e.g. Technology / Financial Services"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Timezone</label>
                <input
                  type="text"
                  value={settings?.settings?.timezone || 'UTC'}
                  onChange={(e) => setSettings({ ...settings, settings: { ...settings.settings, timezone: e.target.value } })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">
                Save Settings
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Onboarding Progress</h2>
            <div className="space-y-3">
              {(onboarding?.sequence || []).map((step, idx) => {
                const currentIdx = (onboarding?.sequence || []).indexOf(onboarding?.onboardingState);
                const isDone = idx <= currentIdx;
                return (
                  <div key={step} className="flex items-center space-x-3 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                      {isDone ? '✓' : idx + 1}
                    </span>
                    <span className={isDone ? 'text-slate-200' : 'text-slate-500'}>{step.replace(/_/g, ' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Users & Invitations */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Invite New User</h2>
            <form onSubmit={handleSendInvitation} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role ID (ObjectId or HR_MANAGER)</label>
                <input
                  type="text"
                  required
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Role ID"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">
                Send Invitation
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Pending Invitations</h2>
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Expires</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/50">
                    <td className="py-2">{inv.email}</td>
                    <td className="py-2">{inv.roleName}</td>
                    <td className="py-2"><span className="px-2 py-0.5 text-xs rounded bg-indigo-500/20 text-indigo-300">{inv.status}</span></td>
                    <td className="py-2">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="py-2">
                      {inv.status === 'PENDING' && (
                        <button onClick={() => handleRevokeInvitation(inv.id)} className="text-xs text-red-400 hover:text-red-300">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Data Import Hub */}
      {activeTab === 'imports' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Employee Dataset Ingestion (CSV / XLSX)</h2>
            <form onSubmit={handlePreviewImport} className="flex items-center space-x-4">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">
                Upload & Dry-Run Preview
              </button>
            </form>

            {previewResult && (
              <div className="mt-4 p-4 bg-slate-800/60 border border-indigo-500/30 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-indigo-300">Dry-Run Preview Summary</h3>
                  <button onClick={() => handleCommitImport(previewResult.importId)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
                    Commit Import ({previewResult.validRowsCount} Rows)
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg"><span className="text-slate-400 block">Total Rows</span><span className="text-lg font-bold">{previewResult.totalRows}</span></div>
                  <div className="bg-slate-900 p-3 rounded-lg"><span className="text-slate-400 block">New Employees</span><span className="text-lg font-bold text-emerald-400">{previewResult.newCount}</span></div>
                  <div className="bg-slate-900 p-3 rounded-lg"><span className="text-slate-400 block">Updated Employees</span><span className="text-lg font-bold text-amber-400">{previewResult.changedCount}</span></div>
                  <div className="bg-slate-900 p-3 rounded-lg"><span className="text-slate-400 block">Errors</span><span className="text-lg font-bold text-red-400">{previewResult.validationErrorCount}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Usage & Quotas */}
      {activeTab === 'usage' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Employees</span>
            <div className="text-3xl font-bold">{usage?.usage?.employees || 0} / {usage?.quotas?.maxEmployees || 50}</div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${usage?.utilizationPercentages?.employees || 0}%` }}></div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Seats</span>
            <div className="text-3xl font-bold">{usage?.usage?.activeUsers || 0} / {usage?.quotas?.maxUsers || 5}</div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${usage?.utilizationPercentages?.activeUsers || 0}%` }}></div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">AI Requests / Mo</span>
            <div className="text-3xl font-bold">{usage?.usage?.aiRequestsThisMonth || 0} / {usage?.quotas?.maxAiRequestsPerMonth || 100}</div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${usage?.utilizationPercentages?.aiRequests || 0}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Revenue & Subscriptions */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-semibold">Active Commercial Subscription</h2>
                <p className="text-xs text-slate-400">Current tier, state machine status, and billing renewal.</p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold uppercase">
                {subscription?.subscription?.status || 'TRIALING'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <span className="text-xs text-slate-400 block">Current Plan</span>
                <span className="text-lg font-bold text-white">{subscription?.plan?.name || 'Free Trial Plan'}</span>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <span className="text-xs text-slate-400 block">Monthly Price</span>
                <span className="text-lg font-bold text-indigo-300">${((subscription?.plan?.monthlyPriceCents || 0) / 100).toFixed(2)} / mo</span>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <span className="text-xs text-slate-400 block">Renewal / Trial End</span>
                <span className="text-lg font-bold text-amber-300">
                  {subscription?.subscription?.trialEndsAt
                    ? new Date(subscription.subscription.trialEndsAt).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex items-center justify-center space-x-2">
                {subscription?.subscription?.status === 'CANCELLED' ? (
                  <button onClick={handleReactivateSubscription} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold">
                    Reactivate
                  </button>
                ) : (
                  <button onClick={handleCancelSubscription} className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-semibold">
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Available Commercial Tiers</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { code: 'FREE_TRIAL', name: 'Free Trial', price: '$0', seats: '5 Seats' },
                { code: 'STARTER', name: 'Starter', price: '$299/mo', seats: '15 Seats' },
                { code: 'PROFESSIONAL', name: 'Professional', price: '$899/mo', seats: '50 Seats' },
                { code: 'ENTERPRISE', name: 'Enterprise', price: '$2,499/mo', seats: '500 Seats' },
              ].map((tier) => (
                <div key={tier.code} className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-200">{tier.name}</h3>
                    <div className="text-xl font-extrabold text-indigo-400">{tier.price}</div>
                    <span className="text-xs text-slate-400 block">{tier.seats}</span>
                  </div>
                  <button
                    onClick={() => handlePlanChange(tier.code)}
                    disabled={subscription?.subscription?.planCode === tier.code}
                    className={`w-full py-1.5 rounded-lg text-xs font-medium transition ${
                      subscription?.subscription?.planCode === tier.code
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {subscription?.subscription?.planCode === tier.code ? 'Current Tier' : 'Switch Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white space-y-4">
            <h2 className="text-lg font-semibold border-b border-slate-800 pb-3">Invoice History</h2>
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="pb-2">Invoice #</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Issued Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan="4" className="py-4 text-center text-slate-500">No invoices generated yet.</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv._id} className="border-b border-slate-800/50">
                      <td className="py-2 font-mono text-indigo-300">{inv.invoiceNumber}</td>
                      <td className="py-2"><span className="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-300">{inv.status}</span></td>
                      <td className="py-2">${(inv.totalCents / 100).toFixed(2)}</td>
                      <td className="py-2">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
