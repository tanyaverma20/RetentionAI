import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

export default function Home() {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  return (
    <div className="space-y-12 py-8">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          RetentionAI &bull; Enterprise Auth & Security Platform
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          AI-Powered Retention Platform with{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
            Zero-Trust Auth
          </span>
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed">
          Production-grade security module featuring JWT access tokens, opaque refresh token rotation, Zod request validation, rate limiting, and fine-grained Role-Based Access Control.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              Go to User Dashboard ({user?.role})
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              Sign In to Account
            </Link>
          )}
          <Link
            to="/forgot-password"
            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all text-sm"
          >
            Reset Password
          </Link>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            01
          </div>
          <h3 className="text-lg font-bold text-white">JWT & Token Rotation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Short-lived HS256 JWT access tokens paired with 384-bit CSPRNG opaque refresh tokens stored only as HMAC-SHA-256 digests.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            02
          </div>
          <h3 className="text-lg font-bold text-white">Zod Validation & RBAC</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Strict runtime payload validation rejecting unknown fields and mass-assignment, coupled with server-enforced role and permission claims.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            03
          </div>
          <h3 className="text-lg font-bold text-white">Rate Limits & Protection</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Multi-factor IP and email keying preventing brute-force login attempts, enumeration attacks, and spamming.
          </p>
        </div>
      </div>
    </div>
  );
}
