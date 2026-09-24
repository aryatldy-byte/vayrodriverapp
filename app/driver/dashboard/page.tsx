'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  getCurrentUser,
  getUserProfile,
  ensureDriverProfile,
  updateDriverAvailability,
  getActiveDriverBooking,
} from '@/lib/supabase/client';
import { TopNav } from '@/components/shared/TopNav';
import { RideRequests } from '@/components/driver/RideRequests';
import { ActiveRide } from '@/components/driver/ActiveRide';
import type { User, Driver, Booking } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-vayroGold/20 text-vayroGold',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  suspended: 'bg-red-500/20 text-red-400',
};

export default function DriverDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const authUser = await getCurrentUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      const userProfile = await getUserProfile(authUser.id);
      if (!userProfile || userProfile.role !== 'driver') {
        router.push('/login');
        return;
      }
      setProfile(userProfile);

      const driverProfile = await ensureDriverProfile(userProfile.id);
      setDriver(driverProfile);

      if (driverProfile) {
        setActiveBooking(await getActiveDriverBooking(driverProfile.id));
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const toggleAvailability = async () => {
    if (!driver) return;
    try {
      const updated = await updateDriverAvailability(driver.id, !driver.is_available);
      setDriver(updated);
      toast.success(updated.is_available ? 'You are now online' : 'You are now offline');
    } catch {
      toast.error('Failed to update availability');
    }
  };

  if (loading) return <div className="min-h-screen bg-vayroDark p-8 text-center text-gray-300">Loading...</div>;

  return (
    <div className="min-h-screen bg-vayroDark">
      <TopNav
        userName={profile?.first_name || profile?.email}
        links={[{ label: 'Documents', href: '/driver/documents' }]}
      />

      <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Driver Dashboard</h1>

        {!driver ? (
          <p className="text-gray-400">Driver profile not found.</p>
        ) : !driver.documents_submitted_at ? (
          <div className="bg-vayroCard border border-vayroGold/40 rounded-lg p-4">
            <p className="text-gray-300 mb-2">
              Please upload your documents to start the verification process.
            </p>
            <a href="/driver/documents" className="text-vayroGold font-semibold text-sm">
              Upload documents →
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-gray-400">Status:</span>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                  STATUS_BADGE[driver.approval_status] || 'bg-gray-500/20 text-gray-300'
                }`}
              >
                {driver.approval_status === 'pending' ? 'Verification Pending' : driver.approval_status}
              </span>
            </div>

            {driver.approval_status === 'approved' && (
              <>
                <button
                  onClick={toggleAvailability}
                  disabled={!!activeBooking}
                  title={activeBooking ? 'Finish your current ride before going offline' : undefined}
                  className={`w-full sm:w-auto py-3 px-6 rounded-lg font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    driver.is_available ? 'bg-green-600 hover:bg-green-700' : 'bg-vayroGold hover:opacity-90 !text-black'
                  }`}
                >
                  {driver.is_available ? 'You are Online (tap to go offline)' : 'You are Offline (tap to go online)'}
                </button>

                <div className="mt-6">
                  {activeBooking ? (
                    <ActiveRide booking={activeBooking} onUpdated={setActiveBooking} />
                  ) : driver.is_available ? (
                    <RideRequests onAccepted={setActiveBooking} />
                  ) : (
                    <p className="text-gray-500 text-sm">Go online to start receiving ride requests.</p>
                  )}
                </div>
              </>
            )}

            {driver.approval_status === 'pending' && (
              <div className="bg-vayroCard border border-vayroBorder rounded-lg p-4">
                <p className="text-gray-300 text-sm">
                  Your documents are submitted and awaiting review by our team. This usually
                  takes up to 24 hours — you'll be able to go online as soon as you're approved.
                </p>
              </div>
            )}

            {driver.approval_status === 'rejected' && (
              <div className="bg-vayroCard border border-red-500/40 rounded-lg p-4">
                <p className="text-gray-300 text-sm mb-2">
                  Your application was not approved
                  {driver.rejection_reason ? `: ${driver.rejection_reason}` : '.'}
                </p>
                <a href="/driver/documents" className="text-vayroGold font-semibold text-sm">
                  Re-upload documents →
                </a>
              </div>
            )}

            {driver.approval_status === 'suspended' && (
              <div className="bg-vayroCard border border-red-500/40 rounded-lg p-4">
                <p className="text-gray-300 text-sm">
                  Your account has been suspended. Please contact support for details.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
