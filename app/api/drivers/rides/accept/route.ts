// ============================================
// Driver Accept Ride API Route
// Save as: app/api/drivers/rides/accept/route.ts
// ============================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { isSameOriginRequest } from '@/lib/security/origin';
import { logError } from '@/lib/logger';

/**
 * POST /api/drivers/rides/accept
 * Driver accepts a ride request
 *
 * Request body:
 * {
 *   booking_id: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   booking: Booking object
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`ride-accept:ip:${ip}`, 30, 15 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: (name: string, value: string, options: any) => {
            cookieStore.set({ name, value, ...options });
          },
          remove: (name: string, options: any) => {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get driver profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .eq('role', 'driver')
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'Driver profile not found' },
        { status: 404 }
      );
    }

    // Get driver details
    const { data: driverProfile, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userProfile.id)
      .single();

    if (driverError || !driverProfile) {
      return NextResponse.json(
        { error: 'Driver details not found' },
        { status: 404 }
      );
    }

    // Verify driver is approved and available
    if (driverProfile.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Driver profile not approved' },
        { status: 403 }
      );
    }

    if (!driverProfile.is_available) {
      return NextResponse.json(
        { error: 'Driver is not available' },
        { status: 400 }
      );
    }

    // Per-authenticated-user rate limit, tighter than the IP limit.
    const userLimit = checkRateLimit(`ride-accept:user:${user.id}`, 20, 15 * 60 * 1000);
    if (!userLimit.success) {
      return NextResponse.json({ error: 'Too many attempts. Please slow down.' }, { status: 429 });
    }

    const body = await request.json();

    if (!body.booking_id || typeof body.booking_id !== 'string') {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify booking is still searching
    if (booking.status !== 'searching') {
      return NextResponse.json(
        { error: 'Booking is no longer available' },
        { status: 400 }
      );
    }

    // Verify driver hasn't already accepted another ride
    const { data: activeBooking, error: activeError } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', driverProfile.id)
      .in('status', ['accepted', 'driver_arriving', 'started'])
      .single();

    if (!activeError && activeBooking) {
      return NextResponse.json(
        { error: 'Driver already has an active booking' },
        { status: 400 }
      );
    }

    // Update booking with driver assignment. The `.eq('status', 'searching')`
    // here (not just the earlier read-check above) closes a race condition:
    // without it, two drivers who both read status='searching' at the same
    // moment could both have their update succeed, silently double-booking
    // the ride. Conditioning the write itself means only the first update
    // wins; the second returns no row and we report it as no-longer-available.
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        driver_id: driverProfile.id,
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.booking_id)
      .eq('status', 'searching')
      .select()
      .single();

    if (updateError || !updatedBooking) {
      logError('Booking update error', updateError);
      return NextResponse.json(
        { error: 'This ride was just accepted by another driver' },
        { status: 409 }
      );
    }

    // TODO: In production, implement:
    // - Send notification to client that driver accepted
    // - Start tracking driver location
    // - Set timeout for driver to reach client
    // - Set up automatic cancellation if driver doesn't start trip within 5 minutes

    return NextResponse.json(
      {
        success: true,
        booking: updatedBooking,
        message: 'Ride accepted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logError('Accept ride error (unhandled)', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
