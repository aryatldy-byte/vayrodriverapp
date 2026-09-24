'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { updatePassword } from '@/lib/supabase/client';
import { FiLock, FiLoader } from 'react-icons/fi';

/**
 * Landing page for the admin password reset email link.
 * Supabase automatically establishes a temporary "recovery" session when
 * the user arrives here via the emailed link, so we just need to collect
 * a new password and call updatePassword().
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      toast.success('Password updated. Please log in again.');
      router.push('/admin/login');
    } catch (error: any) {
      console.error('Update password error:', error);
      toast.error(error?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-vayroDark to-black flex items-center justify-center p-4">
      <div className="bg-vayroCard border border-vayroBorder rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Set a New Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold"
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vayroGold hover:opacity-90 disabled:opacity-50 text-black font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <FiLoader className="animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
