// ============================================
// Admin Approve Driver API Route
// Save as: app/api/admin/drivers/approve/route.ts
// ============================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { isSameOriginRequest } from '@/lib/security/origin';
import { sanitizeInput } from '@/lib/security/sanitize';
import { logError } from '@/lib/logger';

/**
 * POST /api/admin/drivers/approve
 * Admin approves a driver application
 *
 * Request body:
 * {
 *   driver_id: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`admin-approve:ip:${ip}`, 30, 15 * 60 * 1000);
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

    // Verify user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (adminError || adminUser?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can approve drivers' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate driver_id
    if (!body.driver_id) {
      return NextResponse.json(
        { error: 'driver_id is required' },
        { status: 400 }
      );
    }

    // Get driver
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', body.driver_id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Verify all required documents are uploaded. Each row needs its `id`
    // (not just `document_type`) — the review lookup just below joins on
    // it, and `uploaded_at` lets us pick the most recent upload per type
    // in case a driver re-uploaded after a rejection.
    const { data: documents, error: docError } = await supabase
      .from('ride_documents')
      .select('id, document_type, uploaded_at')
      .eq('driver_id', body.driver_id);

    if (docError || !documents) {
      return NextResponse.json(
        { error: 'Error retrieving driver documents' },
        { status: 500 }
      );
    }

    const uploadedTypes = new Set(documents.map((d: any) => d.document_type));
    const requiredDocs = ['license', 'police_clearance', 'address_proof'];
    const missingDocs = requiredDocs.filter((doc) => !uploadedTypes.has(doc));

    if (missingDocs.length > 0) {
      return NextResponse.json(
        {
          error: 'Driver has not uploaded all required documents',
          missingDocuments: missingDocs,
        },
        { status: 400 }
      );
    }

    // Verify all documents have been reviewed and approved
    const { data: reviews, error: reviewError } = await supabase
      .from('ride_documents_reviews')
      .select('document_id, status')
      .in(
        'document_id',
        documents.map((d: any) => d.id)
      );

    if (reviewError) {
      return NextResponse.json(
        { error: 'Error retrieving document reviews' },
        { status: 500 }
      );
    }

    // For each required document type, check the MOST RECENTLY uploaded
    // document of that type has an approved review — rather than just
    // checking every review row is approved, which could be fooled by a
    // stale 'rejected' review sitting on an old document the driver has
    // since re-uploaded and gotten approved.
    const reviewByDocumentId = new Map((reviews || []).map((r: any) => [r.document_id, r.status]));
    const latestDocumentByType = new Map<string, { id: string; uploaded_at: string }>();
    for (const doc of documents as any[]) {
      const existing = latestDocumentByType.get(doc.document_type);
      if (!existing || new Date(doc.uploaded_at) > new Date(existing.uploaded_at)) {
        latestDocumentByType.set(doc.document_type, doc);
      }
    }

    const allApproved = requiredDocs.every((type) => {
      const latestDoc = latestDocumentByType.get(type);
      return latestDoc && reviewByDocumentId.get(latestDoc.id) === 'approved';
    });

    if (!allApproved) {
      return NextResponse.json(
        { error: 'Not all documents have been approved' },
        { status: 400 }
      );
    }

    // Update driver status
    const { data: updatedDriver, error: updateError } = await supabase
      .from('drivers')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', body.driver_id)
      .select()
      .single();

    if (updateError) {
      logError('Driver update error', updateError);
      return NextResponse.json(
        { error: 'Failed to approve driver' },
        { status: 500 }
      );
    }

    // Update user status to active
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', driver.user_id);

    if (userUpdateError) {
      logError('User update error', userUpdateError);
    }

    // TODO: In production, implement:
    // - Send approval email to driver
    // - Create driver onboarding tasks
    // - Set up performance tracking

    return NextResponse.json(
      {
        success: true,
        driver: updatedDriver,
        message: 'Driver approved successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logError('Approve driver error (unhandled)', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/drivers/reject
 * Admin rejects a driver application
 *
 * Request body:
 * {
 *   driver_id: string
 *   rejection_reason: string
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`admin-reject:ip:${ip}`, 30, 15 * 60 * 1000);
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

    // Verify user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (adminError || adminUser?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can reject drivers' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.driver_id || !body.rejection_reason || typeof body.rejection_reason !== 'string') {
      return NextResponse.json(
        { error: 'driver_id and rejection_reason are required' },
        { status: 400 }
      );
    }

    const rejectionReason = sanitizeInput(body.rejection_reason, 500);
    if (!rejectionReason) {
      return NextResponse.json({ error: 'rejection_reason cannot be empty' }, { status: 400 });
    }

    // Get driver
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', body.driver_id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Update driver status
    const { data: updatedDriver, error: updateError } = await supabase
      .from('drivers')
      .update({
        approval_status: 'rejected',
        rejection_reason: rejectionReason,
      })
      .eq('id', body.driver_id)
      .select()
      .single();

    if (updateError) {
      logError('Driver update error', updateError);
      return NextResponse.json(
        { error: 'Failed to reject driver' },
        { status: 500 }
      );
    }

    // TODO: In production, implement:
    // - Send rejection email with reason to driver
    // - Allow driver to reapply after certain period
    // - Track rejection reasons for analytics

    return NextResponse.json(
      {
        success: true,
        driver: updatedDriver,
        message: 'Driver rejected',
      },
      { status: 200 }
    );
  } catch (error) {
    logError('Reject driver error (unhandled)', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
