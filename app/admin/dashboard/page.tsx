'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getUserProfile, logout } from '@/lib/supabase/client';
import { TopNav } from '@/components/shared/TopNav';
import { DriverVerification } from '@/components/admin/DriverVerification';
import { BookingsManager } from '@/components/admin/BookingsManager';
import type { User } from '@/lib/types';

export default function AdminDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'bookings' | 'drivers'>('bookings');

  useEffect(() => {
    const load = async () => {
      const authUser = await getCurrentUser();
      if (!authUser) {
        router.push('/admin/login');
        return;
      }

      const userProfile = await getUserProfile(authUser.id);
      if (!userProfile || userProfile.role !== 'admin') {
        await logout();
        router.push('/admin/login');
        return;
      }
      setProfile(userProfile);
      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-vayroDark p-8 text-center text-gray-300">Loading...</div>;

  return (
    <div className="min-h-screen bg-vayroDark">
      <TopNav title="Vayro Admin" userName={profile?.first_name || profile?.email} />
      <div className="container mx-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setSection('bookings')}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${
                section === 'bookings' ? 'bg-vayroGold !text-black' : 'bg-vayroCard text-gray-400 hover:text-white'
              }`}
            >
              Ride Requests
            </button>
            <button
              onClick={() => setSection('drivers')}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${
                section === 'drivers' ? 'bg-vayroGold !text-black' : 'bg-vayroCard text-gray-400 hover:text-white'
              }`}
            >
              Drivers
            </button>
          </div>
        </div>
        {section === 'bookings' ? <BookingsManager /> : <DriverVerification />}
      </div>
    </div>
  );
}
