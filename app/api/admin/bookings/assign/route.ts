// ============================================
// Admin Assign Driver to Booking API Route
// Save as: app/api/admin/bookings/assign/route.ts
// ============================================
//
// Lets an admin manually assign an approved driver to a client's
// unassigned ("searching") booking — for when a driver hasn't
// self-accepted yet (e.g. no one's online, or the admin wants to
// dispatch a specific driver directly).

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { isSameOriginRequest } from '@/lib/security/origin';
import { logError } from '@/lib/logger';

/**
 * POST /api/admin/bookings/assign
 * Request body: { booking_id: string, driver_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`booking-assign:ip:${ip}`, 60, 15 * 60 * 1000);
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (adminError || adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can assign drivers' }, { status: 403 });
    }

    const userLimit = checkRateLimit(`booking-assign:user:${user.id}`, 40, 15 * 60 * 1000);
    if (!userLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await request.json();

    if (!body.booking_id || typeof body.booking_id !== 'string') {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }
    if (!body.driver_id || typeof body.driver_id !== 'string') {
      return NextResponse.json({ error: 'driver_id is required' }, { status: 400 });
    }

    // Confirm the booking still needs a driver.
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', body.booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'searching') {
      return NextResponse.json({ error: 'Booking is no longer available' }, { status: 400 });
    }

    // Confirm the driver is real, approved, and free.
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', body.driver_id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    if (driver.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Driver is not approved' }, { status: 400 });
    }

    const { data: activeBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('driver_id', driver.id)
      .in('status', ['accepted', 'driver_arriving', 'started'])
      .maybeSingle();

    if (activeBooking) {
      return NextResponse.json(
        { error: 'This driver already has an active ride' },
        { status: 400 }
      );
    }

    // `.eq('status', 'searching')` on the write (not just the read-check
    // above) closes the same race a driver's self-accept guards against:
    // if two admins (or an admin and a driver) assign this booking at the
    // same instant, only the first write actually matches and succeeds.
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        driver_id: driver.id,
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.booking_id)
      .eq('status', 'searching')
      .select()
      .single();

    if (updateError || !updatedBooking) {
      logError('Admin booking assign error', updateError);
      return NextResponse.json(
        { error: 'This ride was just claimed by someone else' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: true, booking: updatedBooking, message: 'Driver assigned' },
      { status: 200 }
    );
  } catch (error) {
    logError('Admin booking assign error (unhandled)', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
