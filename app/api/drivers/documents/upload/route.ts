// ============================================
// Driver Document Upload API Route
// ============================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { isSameOriginRequest } from '@/lib/security/origin';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // CSRF: reject cross-site requests to this cookie-authenticated route.
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    // Rate limit by IP before touching auth/DB.
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`doc-upload:ip:${ip}`, 20, 15 * 60 * 1000);
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

    // Per-authenticated-user rate limit, tighter than the IP limit.
    const userLimit = checkRateLimit(`doc-upload:user:${user.id}`, 10, 15 * 60 * 1000);
    if (!userLimit.success) {
      return NextResponse.json({ error: 'Too many upload attempts. Please slow down.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;
    const driverId = formData.get('driverId') as string | null;

    if (!file || !documentType || !driverId) {
      return NextResponse.json(
        { error: 'file, documentType, and driverId are required' },
        { status: 400 }
      );
    }

    const allowedDocTypes = ['license', 'police_clearance', 'address_proof'];
    if (!allowedDocTypes.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 });
    }

    // ✅ CRITICAL FIX: verify the driver profile being uploaded to belongs
    // to the authenticated user. Without this, any logged-in driver could
    // pass a different driverId in the form data and upload (or overwrite)
    // documents for someone else's profile.
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('user_id')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const { data: ownerProfile, error: ownerProfileError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (ownerProfileError || !ownerProfile || driver.user_id !== ownerProfile.id) {
      return NextResponse.json(
        { error: 'Unauthorized: you can only upload documents for your own driver profile' },
        { status: 403 }
      );
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
    }

    // Sanitize the filename before it becomes part of a storage path —
    // strip path separators and anything that isn't a safe filename char
    // so a crafted file.name can't traverse directories or break parsing.
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    const fileName = `${driverId}/${documentType}/${Date.now()}-${safeFileName}`;

    const { error: storageError } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, file);

    if (storageError) {
      logError('Storage upload error', storageError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('driver-documents')
      .getPublicUrl(fileName);

    const { data: document, error: dbError } = await supabase
      .from('ride_documents')
      .insert({
        driver_id: driverId,
        document_type: documentType,
        document_url: urlData.publicUrl,
        file_name: safeFileName,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      logError('Document record error', dbError);
      return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    logError('Document upload error (unhandled)', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
