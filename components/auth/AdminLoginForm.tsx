// ============================================
// Admin Login Form (email + password)
// components/auth/AdminLoginForm.tsx
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  adminSignIn,
  adminRequestPasswordReset,
  getUserProfile,
  logout,
} from '@/lib/supabase/client';
import { FiMail, FiLock, FiArrowRight, FiLoader, FiEye, FiEyeOff } from 'react-icons/fi';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const { user } = await adminSignIn(email, password);
      if (!user) throw new Error('Login failed');

      const profile = await getUserProfile(user.id);

      if (!profile || profile.role !== 'admin') {
        await logout();
        toast.error('This account is not an admin account');
        setLoading(false);
        return;
      }

      toast.success('Welcome back');
      router.push('/admin/dashboard');
    } catch (error: any) {
      console.error('Admin login error:', error);
      toast.error(error?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Enter the admin email to reset');
      return;
    }

    setResetLoading(true);
    try {
      await adminRequestPasswordReset(resetEmail);
      toast.success('Password reset email sent (if the account exists)');
      setShowForgot(false);
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error?.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="bg-vayroCard border border-vayroBorder rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Vayro Admin</h1>
        <p className="text-gray-400">Sign in to manage the platform</p>
      </div>

      {!showForgot ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-vayroGold" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-vayroDark border border-vayroBorder text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-3 text-gray-400 hover:text-vayroGold"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vayroGold hover:opacity-90 disabled:opacity-50 text-black font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <FiLoader className="animate-spin" />}
            Log In
            <FiArrowRight />
          </button>

          <button
            type="button"
            onClick={() => { setShowForgot(true); setResetEmail(email); }}
            className="w-full text-vayroGold hover:opacity-80 text-sm font-semibold py-1"
          >
            Forgot password?
          </button>
        </form>
      ) : (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <p className="text-sm text-gray-400">
            Enter your admin email and we'll send a password reset link (requires email delivery
            to be configured on your Supabase project).
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold"
                disabled={resetLoading}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={resetLoading}
            className="w-full bg-vayroGold hover:opacity-90 disabled:opacity-50 text-black font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {resetLoading && <FiLoader className="animate-spin" />}
            Send Reset Link
          </button>
          <button
            type="button"
            onClick={() => setShowForgot(false)}
            className="w-full text-gray-500 hover:text-gray-300 text-sm py-1"
          >
            ← Back to login
          </button>
        </form>
      )}

      <p className="text-center text-xs text-gray-500 mt-6">
        Rider or driver?{' '}
        <a href="/login" className="text-vayroGold font-semibold">
          Log in here
        </a>
      </p>
    </div>
  );
}
