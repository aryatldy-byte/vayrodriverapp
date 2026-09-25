// ============================================
// Supabase Client Configuration
// lib/supabase/client.ts
// ============================================

import { createBrowserClient } from '@supabase/ssr';

// Fall back to placeholder values so the app never hard-crashes if env vars
// are briefly missing. Real calls will simply fail (caught by try/catch)
// rather than blowing up the whole page.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Vayro] Supabase env vars are not set — running with placeholder values. ' +
      'Auth and database features will not work until .env.local is filled in.'
  );
}

export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

export const supabase = createClient();

/**
 * ============================================
 * RIDER / DRIVER AUTHENTICATION (OTP)
 * ============================================
 */

/**
 * Send a one-time-password to an email address.
 */
export async function sendEmailOTP(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return data;
}

/**
 * Send a one-time-password via SMS to a phone number.
 * Phone must be in E.164 format, e.g. +919845000001.
 * Requires an SMS provider (Twilio, MessageBird, etc.) configured in
 * Supabase Auth settings — otherwise this call will fail.
 */
export async function sendPhoneOTP(phone: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return data;
}

/**
 * Verify an email OTP code and create a session.
 */
export async function verifyEmailOTP(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data;
}

/**
 * Verify a phone OTP (SMS) code and create a session.
 */
export async function verifyPhoneOTP(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return data;
}

/**
 * ============================================
 * ADMIN AUTHENTICATION (email + password)
 * ============================================
 */

/**
 * Sign in as admin using email + password.
 * The calling page is responsible for checking the resulting user's
 * role === 'admin' in the users table, and signing them out again if not.
 */
export async function adminSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Request a password reset email for an admin account.
 * Requires Supabase email delivery (SMTP) to be configured to actually arrive.
 */
export async function adminRequestPasswordReset(email: string, redirectTo?: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL}/admin/reset-password`,
  });
  if (error) throw error;
  return data;
}

/**
 * Set a new password (used on the reset-password landing page, after the
 * user clicks the link in their reset email — Supabase will already have
 * a valid recovery session active at that point).
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

/**
 * Marks a user's profile as having a password set. Call this right after
 * updatePassword() succeeds so the login form knows not to prompt again.
 */
export async function markPasswordSet(userId: string) {
  const { error } = await supabase.from('users').update({ has_password: true }).eq('id', userId);
  if (error) throw error;
}

/**
 * ============================================
 * SHARED AUTH HELPERS
 * ============================================
 */

export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

export async function getCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return { success: true };
}

/**
 * ============================================
 * USER PROFILE FUNCTIONS
 * ============================================
 */

export async function getUserProfile(authId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get user profile error:', error);
    return null;
  }
}

/**
 * Create a user profile row after first successful OTP verification.
 * role must be 'client' or 'driver' — admin accounts are provisioned
 * separately (see SETUP-GUIDE.md).
 */
export async function createUserProfile(
  authId: string,
  role: 'client' | 'driver',
  contact: { email?: string; phone?: string }
) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: authId,
      email: contact.email || `${authId}@phone.vayro.local`,
      phone: contact.phone || null,
      role,
      status: role === 'driver' ? 'inactive' : 'active',
    })
    .select()
    .single();

  if (error) throw error;

  if (role === 'driver') {
    const { error: driverError } = await supabase.from('drivers').insert({
      user_id: data.id,
      license_number: `PENDING-${data.id.slice(0, 8)}`,
      vehicle_type: 'automatic',
      approval_status: 'pending',
    });
    if (driverError) throw driverError;
  }

  return data;
}

export async function updateUserProfile(userId: string, updates: any) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update user profile error:', error);
    throw error;
  }
}

/**
 * ============================================
 * DRIVER FUNCTIONS
 * ============================================
 */

export async function getDriverProfileByUserId(userId: string) {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get driver profile error:', error);
    return null;
  }
}

/**
 * Get a driver's profile, creating a placeholder "pending" row if one
 * doesn't exist yet. Normally the drivers row is created alongside the
 * user during first-time signup (see createUserProfile), but an existing
 * driver account can end up without one — e.g. after a database reset
 * that wipes the drivers table but keeps the users table. Without this,
 * such a driver would be stuck on "Driver profile not found" with no way
 * to reach the document upload screen.
 */
export async function ensureDriverProfile(userId: string) {
  const existing = await getDriverProfileByUserId(userId);
  if (existing) return existing;

  try {
    const { data, error } = await supabase
      .from('drivers')
      .insert({
        user_id: userId,
        license_number: `PENDING-${userId.slice(0, 8)}`,
        vehicle_type: 'automatic',
        approval_status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Ensure driver profile error:', error);
    return null;
  }
}

export async function updateDriverAvailability(driverId: string, isAvailable: boolean) {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({ is_available: isAvailable })
      .eq('id', driverId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update availability error:', error);
    throw error;
  }
}

export async function uploadDriverDocument(driverId: string, documentType: string, file: File) {
  try {
    const fileName = `${driverId}/${documentType}/${Date.now()}-${file.name}`;
    const { error: storageError } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, file);
    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('ride_documents')
      .insert({
        driver_id: driverId,
        document_type: documentType,
        document_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Upload document error:', error);
    throw error;
  }
}

export async function getDriverDocuments(driverId: string) {
  try {
    const { data, error } = await supabase
      .from('ride_documents')
      .select('*')
      .eq('driver_id', driverId);
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get documents error:', error);
    return [];
  }
}

/**
 * Fetch the review status (approved/rejected/not yet reviewed) for a set
 * of document ids, keyed by document_id for easy lookup in the admin UI.
 */
export async function getDocumentReviews(documentIds: string[]) {
  if (documentIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('ride_documents_reviews')
      .select('*')
      .in('document_id', documentIds);
    if (error) throw error;
    const byDocumentId: Record<string, any> = {};
    for (const review of data || []) {
      byDocumentId[review.document_id] = review;
    }
    return byDocumentId;
  } catch (error) {
    console.error('Get document reviews error:', error);
    return {};
  }
}

export async function updateDriverLocation(bookingId: string, latitude: number, longitude: number) {
  try {
    const { data, error } = await supabase
      .from('ride_updates')
      .insert({
        booking_id: bookingId,
        driver_latitude: latitude,
        driver_longitude: longitude,
        status: 'accepted',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update location error:', error);
    throw error;
  }
}

/**
 * ============================================
 * BOOKING FUNCTIONS
 * ============================================
 */

export async function getBooking(bookingId: string) {
  try {
    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get booking error:', error);
    return null;
  }
}

/**
 * Ride requests currently waiting for a driver (status = 'searching',
 * not yet claimed by anyone). Visible only to approved + online drivers —
 * see the bookings_select_searching_for_available_drivers RLS policy.
 */
export async function getSearchingBookings() {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'searching')
      .is('driver_id', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get searching bookings error:', error);
    return [];
  }
}

/**
 * A driver's current in-progress ride, if any (accepted, driver_arriving,
 * or started). A driver can only ever have at most one of these at a time
 * — enforced server-side in /api/drivers/rides/accept.
 */
export async function getActiveDriverBooking(driverId: string) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'driver_arriving', 'started'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get active driver booking error:', error);
    return null;
  }
}

/**
 * Advance a driver's own active ride to the next status
 * (accepted -> driver_arriving -> started -> completed). Allowed by the
 * bookings_update_own RLS policy since the driver owns this booking.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: 'driver_arriving' | 'started' | 'completed',
  extra?: { actual_fare?: number }
) {
  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (status === 'started') updates.started_at = new Date().toISOString();
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
    if (extra?.actual_fare != null) updates.actual_fare = extra.actual_fare;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUserBookings(userId: string, role: 'client' | 'driver', page = 1, limit = 10) {
  try {
    const offset = (page - 1) * limit;
    const field = role === 'client' ? 'client_id' : 'driver_id';

    const { data, error, count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq(field, userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data, total: count || 0 };
  } catch (error) {
    console.error('Get user bookings error:', error);
    return { data: [], total: 0 };
  }
}

export async function cancelBooking(bookingId: string, reason: string, cancelledBy: string) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
      })
      .eq('id', bookingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Cancel booking error:', error);
    throw error;
  }
}

export async function rateRide(bookingId: string, rating: number, review: string, role: 'client' | 'driver') {
  try {
    const updates =
      role === 'client'
        ? { client_rating: rating, client_review: review }
        : { driver_rating: rating, driver_review: review };

    const { data, error } = await supabase.from('bookings').update(updates).eq('id', bookingId).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Rate ride error:', error);
    throw error;
  }
}

/**
 * ============================================
 * REAL-TIME SUBSCRIPTIONS
 * ============================================
 */

export function subscribeToBooking(bookingId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`booking:${bookingId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, callback)
    .subscribe();
}

export function subscribeToRideUpdates(bookingId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`ride_updates:${bookingId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ride_updates', filter: `booking_id=eq.${bookingId}` },
      callback
    )
    .subscribe();
}

/**
 * Notifies on any booking change so a driver's ride-request list can
 * refetch and stay live without polling. Deliberately unfiltered: a
 * request that just got accepted by another driver has its status
 * change FROM 'searching' TO 'accepted', and a `status=eq.searching`
 * realtime filter (which matches against the new row) would miss that
 * transition — the request would keep showing as available. Refetching
 * on every change and re-applying the RLS-backed query is what keeps the
 * list correct; the volume of bookings is low enough that this is cheap.
 */
export function subscribeToSearchingBookings(callback: (payload: any) => void) {
  return supabase
    .channel('searching_bookings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, callback)
    .subscribe();
}

export function subscribeToDriverStatus(driverId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`driver:${driverId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` }, callback)
    .subscribe();
}

export async function unsubscribeFromChannel(subscription: any) {
  await supabase.removeChannel(subscription);
}
