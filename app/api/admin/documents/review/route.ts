// ============================================
// Admin Document Review API Route
// Save as: app/api/admin/documents/review/route.ts
// ============================================
//
// Lets an admin approve or reject a single uploaded driver document
// (license / police_clearance / address_proof). The overall
// "Approve Driver" action (see /api/admin/drivers/approve) refuses to
// approve a driver until every required document has a review row here
// with status = 'approved', so this route is the missing link between
// "documents uploaded" and "driver approved".

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { isSameOriginRequest } from '@/lib/security/origin';
import { sanitizeInput } from '@/lib/security/sanitize';
import { logError } from '@/lib/logger';

const REVIEW_STATUSES = new Set(['approved', 'rejected']);

/**
 * POST /api/admin/documents/review
 * Admin approves or rejects one driver document.
 *
 * Request body:
 * {
 *   document_id: string
 *   status: 'approved' | 'rejected'
 *   comments?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`document-review:ip:${ip}`, 60, 15 * 60 * 1000);
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

    // Verify user is admin, and grab their `users.id` (reviews reference
    // users.id, not the auth uid, same as everywhere else in this app).
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (adminError || adminUser?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can review documents' },
        { status: 403 }
      );
    }

    const userLimit = checkRateLimit(`document-review:user:${user.id}`, 40, 15 * 60 * 1000);
    if (!userLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await request.json();

    if (!body.document_id || typeof body.document_id !== 'string') {
      return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
    }

    if (!REVIEW_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const comments = body.comments ? sanitizeInput(body.comments, 500) : null;

    // Make sure the document actually exists first, so a bad id gives a
    // clean 404 instead of a confusing foreign-key failure on insert.
    const { data: document, error: documentError } = await supabase
      .from('ride_documents')
      .select('id, driver_id')
      .eq('id', body.document_id)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // One review row per document — re-reviewing (e.g. after a driver
    // re-uploads, or an admin changes their mind) overwrites the previous
    // verdict rather than leaving stale rows behind that would otherwise
    // confuse the "are all documents approved?" check on the approve route.
    const { data: review, error: upsertError } = await supabase
      .from('ride_documents_reviews')
      .upsert(
        {
          document_id: document.id,
          admin_id: adminUser.id,
          status: body.status,
          comments,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'document_id' }
      )
      .select()
      .single();

    if (upsertError) {
      logError('Document review upsert error', upsertError);
      return NextResponse.json({ error: 'Failed to save document review' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        review,
        message: body.status === 'approved' ? 'Document approved' : 'Document rejected',
      },
      { status: 200 }
    );
  } catch (error) {
    logError('Document review error (unhandled)', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
