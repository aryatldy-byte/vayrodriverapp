'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getUserProfile, ensureDriverProfile } from '@/lib/supabase/client';
import { DocumentUpload } from '@/components/driver/DocumentUpload';

export default function DriverDocumentsPage() {
  const router = useRouter();
  const [driverId, setDriverId] = useState<string | null>(null);
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

      const driverProfile = await ensureDriverProfile(userProfile.id);
      setDriverId(driverProfile?.id || null);
      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-vayroDark p-8 text-center text-gray-300">Loading...</div>;
  if (!driverId) return <div className="min-h-screen bg-vayroDark p-8 text-center text-gray-300">Driver profile not found.</div>;

  return <DocumentUpload driverId={driverId} />;
}
