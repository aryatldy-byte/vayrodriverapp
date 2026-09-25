// ============================================
// Admin Bookings Manager Component
// Save as: components/admin/BookingsManager.tsx
// ============================================
//
// Gives an admin visibility into every client ride/hire request, and —
// for ones still waiting on a driver — lets them manually assign an
// approved driver instead of waiting for a driver to self-accept via
// /api/drivers/rides/accept.

'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import axios from 'axios';
import { supabase } from '@/lib/supabase/client';
import { formatDateTime12Hour } from '@/lib/utils';
import type { Booking, Driver } from '@/lib/types';
import { FiLoader, FiRefreshCw, FiUserPlus } from 'react-icons/fi';

const STATUS_TABS: { value: Booking['status']; label: string }[] = [
  { value: 'searching', label: 'Awaiting Driver' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'started', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function BookingsManager() {
  const [statusTab, setStatusTab] = useState<Booking['status']>('searching');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [pickedDriver, setPickedDriver] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          '*, driver:driver_id(id, vehicle_type, users:user_id(first_name, last_name)), client:client_id(first_name, last_name, phone)'
        )
        .eq('status', statusTab)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setBookings((data as any) || []);
    } catch (error) {
      console.error('Fetch bookings error:', error);
      toast.error('Failed to load ride requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDrivers = async () => {
    try {
      // Approved drivers only — the assign API re-checks approval and
      // that the driver isn't already on an active ride, so this list is
      // just for a sensible dropdown, not the source of truth.
      const { data, error } = await supabase
        .from('drivers')
        .select('*, users:user_id(first_name, last_name)')
        .eq('approval_status', 'approved')
        .order('is_available', { ascending: false });

      if (error) throw error;
      setAvailableDrivers((data as any) || []);
    } catch (error) {
      console.error('Fetch available drivers error:', error);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchAvailableDrivers();

    // Unfiltered: a booking's status changing (e.g. searching -> accepted
    // by a driver elsewhere) needs to disappear from this tab immediately,
    // and a narrower realtime filter would miss that transition.
    const subscription = supabase
      .channel(`admin_bookings_${statusTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, fetchAvailableDrivers)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  const handleAssign = async (bookingId: string) => {
    const driverId = pickedDriver[bookingId];
    if (!driverId) {
      toast.error('Pick a driver first');
      return;
    }

    setAssigning((prev) => ({ ...prev, [bookingId]: true }));
    try {
      await axios.post('/api/admin/bookings/assign', { booking_id: bookingId, driver_id: driverId });
      toast.success('Driver assigned');
      fetchBookings();
    } catch (error: any) {
      console.error('Assign driver error:', error);
      toast.error(error.response?.data?.error || 'Failed to assign driver');
    } finally {
      setAssigning((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  return (
    <div className="bg-vayroCard border border-vayroBorder rounded-lg shadow-lg">
      <div className="p-4 border-b border-vayroBorder flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full transition ${
                statusTab === tab.value
                  ? 'bg-vayroGold !text-black'
                  : 'bg-vayroDark text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={fetchBookings} className="text-gray-400 hover:text-vayroGold transition" title="Refresh">
          <FiRefreshCw />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <FiLoader className="animate-spin text-2xl text-vayroGold" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-400 text-sm">No requests in this category.</p>
        </div>
      ) : (
        <div className="divide-y divide-vayroBorder">
          {bookings.map((booking: any) => (
            <div key={booking.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{booking.pickup_address}</p>
                  {booking.service_type === 'ride' ? (
                    <p className="text-sm text-gray-400 truncate">→ {booking.dropoff_address}</p>
                  ) : (
                    <p className="text-sm text-gray-400 capitalize">
                      Driver hire — {booking.hire_type}
                      {booking.hire_type === 'hourly' && booking.hire_duration_hours
                        ? ` (${booking.hire_duration_hours}h)`
                        : ''}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {booking.client?.first_name
                      ? `${booking.client.first_name} ${booking.client.last_name || ''}`
                      : 'Client'}
                    {booking.client?.phone ? ` · ${booking.client.phone}` : ''}
                    {' · '}
                    {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
                  </p>
                  {booking.booking_type === 'scheduled' && booking.scheduled_at && (
                    <p className="text-xs text-vayroGold mt-1">
                      Scheduled for {formatDateTime12Hour(booking.scheduled_at)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {booking.estimated_fare && (
                    <p className="text-vayroGold font-semibold text-sm">₹{booking.estimated_fare}</p>
                  )}
                  {booking.vehicle_type && (
                    <p className="text-xs text-gray-500 capitalize">{booking.vehicle_type}</p>
                  )}
                </div>
              </div>

              {booking.status === 'searching' ? (
                <div className="flex items-center gap-2 mt-3">
                  <select
                    value={pickedDriver[booking.id] || ''}
                    onChange={(e) => setPickedDriver((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                    className="flex-1 text-sm bg-vayroDark border border-vayroBorder text-white rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-vayroGold"
                  >
                    <option value="">Select a driver…</option>
                    {availableDrivers.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.users?.first_name || 'Driver'} {d.users?.last_name || ''} — {d.vehicle_type}
                        {d.is_available ? ' (online)' : ' (offline)'}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(booking.id)}
                    disabled={assigning[booking.id]}
                    className="flex items-center gap-1 text-sm font-semibold py-1.5 px-3 rounded-md bg-vayroGold hover:opacity-90 disabled:opacity-50 !text-black transition"
                  >
                    {assigning[booking.id] ? <FiLoader className="animate-spin" /> : <FiUserPlus />}
                    Assign
                  </button>
                </div>
              ) : booking.driver ? (
                <p className="text-xs text-gray-400 mt-3">
                  Driver: {booking.driver.users?.first_name || 'Driver'} {booking.driver.users?.last_name || ''} ·{' '}
                  {booking.driver.vehicle_type}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
