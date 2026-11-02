import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, displayName.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const code = typeof err?.code === 'string' ? err.code : '';
      let msg = err?.message || 'Authentication failed';
      if (msg.toLowerCase().includes('not approved')) {
        msg = 'This email is not approved. Please contact the admin.';
      } else if (code === 'auth/user-not-found') {
        msg = 'No account found for this email. Create an account or check your email.';
      } else if (['auth/invalid-credential', 'auth/wrong-password'].includes(code)) {
        msg = 'Incorrect email or password.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err instanceof ApiError && err.status === 404) {
        msg = 'You are using the frontend-only preview. Start the app with "npm.cmd run dev" and open http://localhost:3000. The Apps Script web app URL must also be set in .env.local.';
      } else if (err instanceof TypeError) {
        msg = 'Cannot reach the app server. Start it with "npm.cmd run dev" and open http://localhost:3000.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex items-center justify-center mb-4">
          <img
            src="/logo.png"
            alt="Loanbazaar"
            className="h-24 sm:h-28 w-auto object-contain max-w-[360px] drop-shadow-xs"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F1D38] tracking-tight">
          Team 2 Hub
        </h1>
        <p className="mt-1 text-xs font-semibold text-stone-500 uppercase tracking-wider">
          Lead Assessment & Initial Response Portal
        </p>
      </div>

      {/* Main Auth Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-stone-200/90">
          {/* Mode Switcher Tabs */}
          <div className="flex bg-stone-100 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                mode === 'signin'
                  ? 'bg-white text-[#0F1D38] shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                mode === 'signup'
                  ? 'bg-white text-[#0F1D38] shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-[#0F1D38] mb-1">Your Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Enter your name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-[#0F1D38] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </div>

            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F1D38] mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-[#F37A1F] text-white font-bold text-xs sm:text-sm hover:bg-[#df6a14] transition shadow-md disabled:opacity-60 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? 'Sign In to Hub'
                      : 'Create Account'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-[11px] text-stone-400 mt-4">
          Loanbazaar Internal Operations • Lead Assessment & Initial Response (Team 2)
        </p>
      </div>
    </div>
  );
};
