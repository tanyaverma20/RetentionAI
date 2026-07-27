import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import authService from '../services/authService';
import { fetchCurrentUser } from '../store/slices/authSlice';
import { changePasswordValidationSchema } from '../utils/validators';

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordValidationSchema),
  });

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  const onChangePasswordSubmit = async (data) => {
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setPasswordSuccess(true);
      reset();
    } catch (err) {
      setPasswordError(
        err.response?.data?.error?.message || 'Failed to change password. Please check current password.',
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-8 bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Authenticated Session Active
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Welcome back, {user?.firstName || user?.name || 'User'}!
          </h1>
          <p className="text-slate-300 mt-2 max-w-2xl text-sm">
            RetentionAI Authentication & Authorization Engine is active. Below is your current user context retrieved from the <code className="text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/50 font-mono text-xs">/api/v1/auth/me</code> endpoint.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/30">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name}</h2>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 font-medium">User ID</span>
              <span className="font-mono text-xs text-slate-200 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                {user?.id}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 font-medium">Assigned Role</span>
              <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                {user?.role}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 font-medium">Account Status</span>
              <span className="font-semibold text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                {user?.status || 'ACTIVE'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 font-medium">Department ID</span>
              <span className="font-mono text-xs text-slate-300">
                {user?.departmentId || 'System Global'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setChangePasswordOpen(!changePasswordOpen)}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-all border border-slate-700"
          >
            {changePasswordOpen ? 'Cancel Password Change' : 'Change Password'}
          </button>
        </div>

        {/* Permissions & Security Capabilities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Password Form (if toggled) */}
          {changePasswordOpen && (
            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Change Account Password
              </h3>

              {passwordSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs font-medium">
                  Password successfully updated! All other active refresh token sessions were invalidated.
                </div>
              )}

              {passwordError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs font-medium">
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleSubmit(onChangePasswordSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      {...register('currentPassword')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {errors.currentPassword && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.currentPassword.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      {...register('newPassword')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {errors.newPassword && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.newPassword.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      {...register('confirmPassword')}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {errors.confirmPassword && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-all shadow-md disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* Role-Based Permissions Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center justify-between">
              <span>Role Permissions & RBAC Claims</span>
              <span className="text-xs text-slate-400 font-normal">Enforced by Express Middleware</span>
            </h3>

            <div className="flex flex-wrap gap-2 pt-2">
              {user?.permissions?.map((permission, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-xs rounded-lg font-medium"
                >
                  {permission}
                </span>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Access Token TTL
                </div>
                <div className="text-sm font-semibold text-indigo-400">15 Minutes (HS256 JWT)</div>
                <div className="text-xs text-slate-500 mt-1">
                  Automatically refreshed via Axios response interceptor on expiry.
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Refresh Token Rotation
                </div>
                <div className="text-sm font-semibold text-indigo-400">7 Days (HMAC-SHA-256 Hashed)</div>
                <div className="text-xs text-slate-500 mt-1">
                  Revoked and rotated on every single token exchange.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
