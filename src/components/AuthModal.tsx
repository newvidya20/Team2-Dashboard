import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      onClose();
      if (onSuccess) onSuccess();
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
        msg = 'Authentication is unavailable in this frontend-only preview. Start the configured app server to sign in or create an account.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F37A1F] font-bold text-xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            L2
          </div>
          <h2 className="text-2xl font-black text-[#0F1D38]">
            {mode === 'signin' ? 'Sign in to Team 2 Hub' : 'Create Team 2 Account'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {mode === 'signin'
              ? 'Lead Assessment & Initial Response Portal'
              : 'Only email addresses approved by your admin can create an account. Your name and role are assigned from the approved roster.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-stone-100 p-1 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
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
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
              mode === 'signup'
                ? 'bg-white text-[#0F1D38] shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
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
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
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
                className="w-full pl-10 pr-11 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-2 text-stone-400 hover:text-stone-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#F37A1F] text-white font-bold text-xs hover:bg-[#df6a14] transition shadow-md disabled:opacity-60 flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>
                  {mode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
