// ============================================
// Driver Ride Requests Component
// Save as: components/driver/RideRequests.tsx
// ============================================
//
// Shows unassigned "searching" bookings to an approved, online driver and
// lets them accept one via POST /api/drivers/rides/accept. Visibility is
// enforced by the bookings_select_searching_for_available_drivers RLS
// policy — this component only renders what Supabase actually returns.

'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getSearchingBookings, subscribeToSearchingBookings, unsubscribeFromChannel } from '@/lib/supabase/client';
import type { Booking } from '@/lib/types';
import { FiMapPin, FiLoader, FiRefreshCw } from 'react-icons/fi';

interface RideRequestsProps {
  onAccepted: (booking: Booking) => void;
}

export function RideRequests({ onAccepted }: RideRequestsProps) {
  const [requests, setRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const refresh = async () => {
    const data = await getSearchingBookings();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    const subscription = subscribeToSearchingBookings(() => {
      refresh();
    });

    return () => {
      unsubscribeFromChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = async (bookingId: string) => {
    setAcceptingId(bookingId);
    try {
      const response = await axios.post('/api/drivers/rides/accept', { booking_id: bookingId });
      toast.success('Ride accepted!');
      onAccepted(response.data.booking);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to accept ride';
      toast.error(message);
      // Someone else may have taken it, or it's no longer searching —
      // either way, refresh so the list reflects reality.
      refresh();
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FiLoader className="animate-spin text-2xl text-vayroGold" />
      </div>
    );
  }

  return (
    <div className="bg-vayroCard border border-vayroBorder rounded-lg shadow-lg">
      <div className="p-4 border-b border-vayroBorder flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Ride Requests ({requests.length})</h2>
        <button
          onClick={refresh}
          className="text-gray-400 hover:text-vayroGold transition"
          title="Refresh"
        >
          <FiRefreshCw />
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-400 text-sm">
            No ride requests right now. New requests appear here automatically.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-vayroBorder">
          {requests.map((booking) => (
            <div key={booking.id} className="p-4">
              <div className="flex items-start gap-2 mb-1">
                <FiMapPin className="text-vayroGold mt-0.5 shrink-0" />
                <p className="text-white font-medium">{booking.pickup_address}</p>
              </div>

              {booking.service_type === 'ride' ? (
                <p className="text-sm text-gray-400 ml-6">→ {booking.dropoff_address}</p>
              ) : (
                <p className="text-sm text-gray-400 ml-6 capitalize">
                  Driver hire — {booking.hire_type}
                  {booking.hire_type === 'hourly' && booking.hire_duration_hours
                    ? ` (${booking.hire_duration_hours}h)`
                    : ''}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 ml-6">
                <div className="text-xs text-gray-500">
                  {booking.vehicle_type && <span className="capitalize mr-2">{booking.vehicle_type}</span>}
                  {booking.estimated_fare && <span className="text-vayroGold font-semibold">₹{booking.estimated_fare}</span>}
                  <span className="ml-2">
                    {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
                  </span>
                </div>
                <button
                  onClick={() => handleAccept(booking.id)}
                  disabled={acceptingId === booking.id}
                  className="bg-vayroGold hover:opacity-90 disabled:opacity-50 !text-black font-semibold text-sm py-1.5 px-4 rounded-lg transition flex items-center gap-2"
                >
                  {acceptingId === booking.id && <FiLoader className="animate-spin" />}
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
