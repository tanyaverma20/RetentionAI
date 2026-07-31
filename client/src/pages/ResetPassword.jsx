import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';
import { passwordPolicyRegex, resetPasswordValidationSchema } from '../utils/validators';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordValidationSchema),
    defaultValues: {
      token: tokenFromUrl,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const watchPassword = watch('newPassword', '');

  const rules = [
    { label: 'At least 8 characters long', valid: watchPassword.length >= 8 },
    { label: 'At least one uppercase letter (A-Z)', valid: passwordPolicyRegex.uppercase.test(watchPassword) },
    { label: 'At least one lowercase letter (a-z)', valid: passwordPolicyRegex.lowercase.test(watchPassword) },
    { label: 'At least one number (0-9)', valid: passwordPolicyRegex.number.test(watchPassword) },
    { label: 'At least one special character (!@#$...)', valid: passwordPolicyRegex.special.test(watchPassword) },
  ];

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await authService.resetPassword({
        token: data.token,
        newPassword: data.newPassword,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error?.message || 'Invalid or expired reset token. Please request a new link.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh]">
      <div className="w-full max-w-md p-8 bg-white/90 border border-slate-100 rounded-2xl shadow-card backdrop-blur-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Set New Password</h1>
          <p className="text-sm text-slate-500 mt-2">
            Enter your token and choose a strong, secure password.
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Password Reset Successful!</h2>
              <p className="text-sm text-slate-500">
                All active sessions have been invalidated. Redirecting to login...
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-sm"
            >
              Go to Login Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Reset Token
              </label>
              <input
                type="text"
                placeholder="Paste token from reset email"
                {...register('token')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-mono"
              />
              {errors.token && (
                <p className="text-xs text-red-600 mt-1.5">{errors.token.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                {...register('newPassword')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
              {errors.newPassword && (
                <p className="text-xs text-red-600 mt-1.5">{errors.newPassword.message}</p>
              )}

              {/* Security Checklist */}
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100/80 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Password Complexity Policy
                </p>
                {rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className={rule.valid ? 'text-emerald-600' : 'text-slate-400'}>
                      {rule.valid ? '✓' : '○'}
                    </span>
                    <span className={rule.valid ? 'text-slate-800' : 'text-slate-400'}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                {...register('confirmPassword')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-600 mt-1.5">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:text-slate-900">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
