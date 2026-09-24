// ============================================
// Driver Login Form (Vayro Driver App)
// components/auth/OTPForm.tsx
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  getCurrentUser,
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  sendEmailOTP,
  sendPhoneOTP,
  verifyEmailOTP,
  verifyPhoneOTP,
  adminSignIn, // generic email+password sign-in, not admin-only despite the name
  updatePassword,
  markPasswordSet,
} from '@/lib/supabase/client';
import { FiMail, FiPhone, FiLock, FiUser, FiArrowRight, FiLoader, FiEye, FiEyeOff } from 'react-icons/fi';

type Mode = 'otp' | 'password';
type Step = 'contact' | 'otp' | 'setPassword';
type ContactMethod = 'email' | 'phone';

/**
 * Driver Login Form
 *
 * Two ways in:
 * - OTP (email or phone) — used for first-time signup, always creates a
 *   'driver' profile. Right after a brand-new account is verified, we ask
 *   the person to set a password so future logins can skip OTP entirely.
 * - Password — for anyone who already set one, a normal email+password
 *   sign-in.
 *
 * Phone OTP requires an SMS provider configured in Supabase Auth settings.
 */
export function OTPForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('otp');

  // OTP flow state
  const [step, setStep] = useState<Step>('contact');
  const [method, setMethod] = useState<ContactMethod>('email');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // New-password state (shown right after first-time signup)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  // Only a brand-new signup needs to supply their name here — an
  // existing driver revisiting this step (because they never set a
  // password before) already has one on file.
  const [isNewSignup, setIsNewSignup] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Password-login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const startResendCountdown = () => {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (method === 'email') {
      if (!contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        toast.error('Please enter a valid email');
        return;
      }
    } else {
      if (!contact || !/^\+[1-9]\d{7,14}$/.test(contact)) {
        toast.error('Please enter a valid phone number with country code, e.g. +919845000001');
        return;
      }
    }

    setLoading(true);
    try {
      if (method === 'email') {
        await sendEmailOTP(contact);
      } else {
        await sendPhoneOTP(contact);
      }
      setStep('otp');
      toast.success(`OTP sent to your ${method}`);
      startResendCountdown();
    } catch (error: any) {
      console.error('OTP send error:', error);
      toast.error(error?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length < 4) {
      toast.error('Please enter the code from your email/SMS');
      return;
    }

    setLoading(true);
    try {
      if (method === 'email') {
        await verifyEmailOTP(contact, otp);
      } else {
        await verifyPhoneOTP(contact, otp);
      }

      const authUser = await getCurrentUser();
      if (!authUser) throw new Error('Verification succeeded but no session was created');

      let profile = await getUserProfile(authUser.id);
      const isNewAccount = !profile;

      if (isNewAccount) {
        profile = await createUserProfile(authUser.id, 'driver', {
          email: method === 'email' ? contact : undefined,
          phone: method === 'phone' ? contact : undefined,
        });
      }

      if (!profile.has_password) {
        // No password on file yet (new account, or an old one that skipped
        // this step before) — ask them to set one before continuing
        setPendingUserId(profile.id);
        setIsNewSignup(isNewAccount);
        toast.success(
          isNewAccount ? 'Account created! Tell us your name, then set a password.' : 'Please set a password to continue.'
        );
        setStep('setPassword');
      } else {
        toast.success('Logged in successfully');
        router.push('/driver/dashboard');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      toast.error(error?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNewSignup && !firstName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (isNewSignup && pendingUserId) {
        await updateUserProfile(pendingUserId, {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
        });
      }
      await updatePassword(newPassword);
      if (pendingUserId) {
        await markPasswordSet(pendingUserId);
      }
      toast.success('Password set! You can use it to log in next time.');
      router.push('/driver/dashboard');
    } catch (error: any) {
      console.error('Set password error:', error);
      toast.error(error?.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPassword = async () => {
    if (isNewSignup && !firstName.trim()) {
      toast.error('Please enter your name first');
      return;
    }

    if (isNewSignup && pendingUserId) {
      setLoading(true);
      try {
        await updateUserProfile(pendingUserId, {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
        });
      } catch (error: any) {
        console.error('Save name error:', error);
        toast.error(error?.message || 'Failed to save your name');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    router.push('/driver/dashboard');
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      toast.error('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const { user } = await adminSignIn(loginEmail, loginPassword);
      if (!user) throw new Error('Login failed');

      const profile = await getUserProfile(user.id);
      if (!profile || profile.role !== 'driver') {
        toast.error('This account is not a driver account');
        setLoading(false);
        return;
      }

      toast.success('Welcome back');
      router.push('/driver/dashboard');
    } catch (error: any) {
      console.error('Password login error:', error);
      toast.error(error?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      if (method === 'email') {
        await sendEmailOTP(contact);
      } else {
        await sendPhoneOTP(contact);
      }
      toast.success('OTP resent');
      startResendCountdown();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-vayroCard border border-vayroBorder rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="relative w-40 h-40 mx-auto mb-2">
          <Image src="/logo.jpg" alt="Vayro" fill className="object-contain" priority />
        </div>
        <p className="text-gray-400">Your driver on demand</p>
      </div>

      {/* Mode toggle — hidden once mid-flow (otp/setPassword steps) */}
      {step === 'contact' && (
        <div className="flex rounded-lg border border-vayroBorder overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setMode('otp')}
            className={`flex-1 py-2 text-sm font-semibold transition ${
              mode === 'otp' ? 'bg-vayroGold text-black' : 'bg-transparent text-gray-300'
            }`}
          >
            OTP Login
          </button>
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 py-2 text-sm font-semibold transition ${
              mode === 'password' ? 'bg-vayroGold text-black' : 'bg-transparent text-gray-300'
            }`}
          >
            Password Login
          </button>
        </div>
      )}

      {mode === 'password' && step === 'contact' && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-vayroGold" />
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((prev) => !prev)}
                className="absolute right-3 top-3 text-gray-400 hover:text-vayroGold"
                tabIndex={-1}
                aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
              >
                {showLoginPassword ? <FiEyeOff /> : <FiEye />}
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
          <p className="text-center text-xs text-gray-500">
            Haven't set a password yet? Use OTP Login above the first time.
          </p>
        </form>
      )}

      {mode === 'otp' && step === 'contact' && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div className="flex rounded-lg border border-vayroBorder overflow-hidden mb-2">
            <button
              type="button"
              onClick={() => { setMethod('email'); setContact(''); }}
              className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 ${
                method === 'email' ? 'bg-vayroGold text-black' : 'bg-transparent text-gray-300'
              }`}
            >
              <FiMail /> Email
            </button>
            <button
              type="button"
              onClick={() => { setMethod('phone'); setContact(''); }}
              className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 ${
                method === 'phone' ? 'bg-vayroGold text-black' : 'bg-transparent text-gray-300'
              }`}
            >
              <FiPhone /> Phone
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {method === 'email' ? 'Email address' : 'Phone number'}
            </label>
            <div className="relative">
              {method === 'email' ? (
                <FiMail className="absolute left-3 top-3 text-vayroGold" />
              ) : (
                <FiPhone className="absolute left-3 top-3 text-vayroGold" />
              )}
              <input
                type={method === 'email' ? 'email' : 'tel'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={method === 'email' ? 'you@example.com' : '+919845000001'}
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
                disabled={loading}
              />
            </div>
            {method === 'phone' && (
              <p className="text-xs text-gray-500 mt-1">Include your country code, e.g. +91</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vayroGold hover:opacity-90 disabled:opacity-50 text-black font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <FiLoader className="animate-spin" />}
            Send OTP
            <FiArrowRight />
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Enter OTP</label>
            <p className="text-xs text-gray-500 mb-3">
              We sent a code to <span className="font-semibold text-gray-300">{contact}</span>
            </p>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter code"
                maxLength={10}
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold text-center text-2xl tracking-widest"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 4}
            className="w-full bg-vayroGold hover:opacity-90 disabled:opacity-50 text-black font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading && <FiLoader className="animate-spin" />}
            Verify OTP
          </button>

          <button
            type="button"
            onClick={() => setStep('contact')}
            className="w-full text-vayroGold hover:opacity-80 font-semibold py-2 text-sm"
            disabled={loading}
          >
            Use a different {method === 'email' ? 'email' : 'phone number'}
          </button>

          {resendCountdown > 0 ? (
            <p className="text-center text-sm text-gray-500">Resend OTP in {resendCountdown}s</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="w-full text-vayroGold hover:opacity-80 font-semibold py-2 text-sm"
            >
              Resend OTP
            </button>
          )}
        </form>
      )}

      {step === 'setPassword' && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          {isNewSignup && (
            <>
              <p className="text-sm text-gray-400 text-center">Tell us your name first.</p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-3 text-vayroGold" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    maxLength={100}
                    className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Last Name (optional)</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-3 text-vayroGold" />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    maxLength={100}
                    className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <p className="text-sm text-gray-400 text-center">
            Set a password so you can log in faster next time (optional, but recommended).
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-vayroGold" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
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
                placeholder="Re-enter password"
                className="w-full pl-10 pr-4 py-3 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold placeholder-gray-500"
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
            Set Password & Continue
          </button>
          <button
            type="button"
            onClick={handleSkipPassword}
            className="w-full text-gray-500 hover:text-gray-300 text-sm py-1"
            disabled={loading}
          >
            Skip for now
          </button>
        </form>
      )}

      <p className="text-center text-xs text-gray-500 mt-6">
        Admin?{' '}
        <a href="/admin/login" className="text-vayroGold font-semibold">
          Log in here
        </a>
      </p>
    </div>
  );
}
