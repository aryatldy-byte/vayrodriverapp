// ============================================
// Driver Active Ride Component
// Save as: components/driver/ActiveRide.tsx
// ============================================
//
// Shown once a driver has accepted a ride request. Lets them progress the
// booking through accepted -> driver_arriving -> started -> completed.
// Updates go straight through Supabase (not a dedicated API route) using
// the existing bookings_update_own RLS policy, the same pattern already
// used elsewhere in this app for toggling driver availability.

'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { updateBookingStatus } from '@/lib/supabase/client';
import { formatDateTime12Hour } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/lib/types';
import { FiMapPin, FiLoader, FiCheckCircle } from 'react-icons/fi';

interface ActiveRideProps {
  booking: Booking;
  onUpdated: (booking: Booking | null) => void;
}

const NEXT_STEP: Partial<Record<BookingStatus, { next: 'driver_arriving' | 'started' | 'completed'; label: string }>> = {
  accepted: { next: 'driver_arriving', label: "I'm on my way" },
  driver_arriving: { next: 'started', label: 'Start trip' },
  started: { next: 'completed', label: 'Complete ride' },
};

export function ActiveRide({ booking, onUpdated }: ActiveRideProps) {
  const [loading, setLoading] = useState(false);

  const step = NEXT_STEP[booking.status];

  const handleAdvance = async () => {
    if (!step) return;
    setLoading(true);
    try {
      const updated = await updateBookingStatus(
        booking.id,
        step.next,
        step.next === 'completed' ? { actual_fare: booking.estimated_fare } : undefined
      );
      if (step.next === 'completed') {
        toast.success('Ride completed!');
        onUpdated(null);
      } else {
        toast.success('Ride updated');
        onUpdated(updated);
      }
    } catch (error) {
      console.error('Update ride status error:', error);
      toast.error('Failed to update ride status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-vayroCard border border-vayroGold/40 rounded-lg shadow-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">Current Ride</h2>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-vayroGold/20 text-vayroGold capitalize">
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-start gap-2 mb-1">
        <FiMapPin className="text-vayroGold mt-0.5 shrink-0" />
        <p className="text-white font-medium">{booking.pickup_address}</p>
      </div>
      {booking.service_type === 'ride' ? (
        <p className="text-sm text-gray-400 ml-6">→ {booking.dropoff_address}</p>
      ) : (
        <p className="text-sm text-gray-400 ml-6 capitalize">
          Driver hire — {booking.hire_type}
          {booking.hire_type === 'hourly' && booking.hire_duration_hours ? ` (${booking.hire_duration_hours}h)` : ''}
        </p>
      )}

      {booking.booking_type === 'scheduled' && booking.scheduled_at && (
        <p className="text-xs text-vayroGold ml-6 mt-1">
          Scheduled for {formatDateTime12Hour(booking.scheduled_at)}
        </p>
      )}

      {booking.estimated_fare && (
        <p className="text-sm text-gray-400 ml-6 mt-1">Est. fare: ₹{booking.estimated_fare}</p>
      )}

      {step && (
        <button
          onClick={handleAdvance}
          disabled={loading}
          className="mt-4 w-full sm:w-auto bg-vayroGold hover:opacity-90 disabled:opacity-50 !text-black font-semibold py-2.5 px-6 rounded-lg transition flex items-center justify-center gap-2"
        >
          {loading ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
          {step.label}
        </button>
      )}
    </div>
  );
}
