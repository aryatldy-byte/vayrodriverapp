// ============================================
// Terms & Conditions Modal (first-login gate)
// components/shared/TermsModal.tsx
// ============================================
//
// Shown once, right after login, whenever the signed-in user's profile has
// terms_accepted !== true. Not dismissable (no backdrop click, no close
// button) — the person must scroll through and tick "I agree" before the
// Accept button is enabled. On accept, the parent is responsible for
// persisting `terms_accepted: true` on the user's profile (see
// updateUserProfile in lib/supabase/client.ts) so the modal never shows
// again for that account.

'use client';

import { useState } from 'react';
import { FiCheckCircle, FiLoader } from 'react-icons/fi';

interface TermsModalProps {
  open: boolean;
  onAccept: () => Promise<void> | void;
  /** Slightly tailors the copy — defaults to generic "our platform" language. */
  audience?: 'client' | 'driver';
}

export function TermsModal({ open, onAccept, audience }: TermsModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div className="w-full max-w-lg bg-[#141414] border border-[#2A2A2A] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 sm:p-6 border-b border-[#2A2A2A]">
          <h2 id="terms-modal-title" className="text-xl font-bold text-white">
            Terms &amp; Conditions
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Please review and accept before you continue{audience === 'driver' ? ' driving with Vayro' : ' using Vayro'}.
          </p>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto text-sm text-gray-300 space-y-4">
          <section>
            <h3 className="text-white font-semibold mb-1">1. Acceptance of Terms</h3>
            <p>
              By creating an account and using the Vayro platform{audience === 'driver' ? ' as a driver' : ''}, you agree to
              be bound by these Terms &amp; Conditions and any policies referenced within them. If you do not agree,
              please do not continue using the app.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1">2. Service Description</h3>
            <p>
              Vayro connects riders with independent drivers for on-demand rides and driver-hire bookings. Vayro is a
              technology platform; it does not itself provide transportation services.
            </p>
          </section>

          {audience === 'driver' ? (
            <section>
              <h3 className="text-white font-semibold mb-1">3. Driver Responsibilities</h3>
              <p>
                You confirm that all documents you submit (license, address proof, and any others requested) are
                genuine and current, that you hold a valid driving license for the vehicle class you register, and
                that you will comply with all applicable traffic and safety laws while active on the platform.
                Vayro may suspend or reject your account if submitted information is found to be inaccurate.
              </p>
            </section>
          ) : (
            <section>
              <h3 className="text-white font-semibold mb-1">3. Booking &amp; Payment</h3>
              <p>
                Estimated fares shown at booking time are indicative; the final fare depends on actual distance,
                time, and any applicable ride or hire policies. Unless stated otherwise, payment is due directly to
                the driver at the end of the trip via the payment method shown in the app.
              </p>
            </section>
          )}

          <section>
            <h3 className="text-white font-semibold mb-1">4. Cancellations</h3>
            <p>
              Bookings may be cancelled from the app before a trip starts. Repeated last-minute cancellations may
              affect your ability to book or accept rides in the future.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1">5. Conduct &amp; Safety</h3>
            <p>
              All users are expected to treat each other respectfully. Harassment, unsafe driving, or any activity
              that endangers another person may result in immediate suspension of your account.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1">6. Privacy</h3>
            <p>
              Information you provide (contact details, location, and — for drivers — verification documents) is
              used only to operate the Vayro service: matching bookings, verifying drivers, and keeping both parties
              informed about a trip in progress.
            </p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-1">7. Changes to These Terms</h3>
            <p>
              Vayro may update these Terms from time to time. Continued use of the app after an update constitutes
              acceptance of the revised Terms.
            </p>
          </section>
        </div>

        <div className="p-5 sm:p-6 border-t border-[#2A2A2A] space-y-3">
          <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="accent-[#D4AF37] w-4 h-4 mt-0.5"
              disabled={submitting}
            />
            I have read and agree to the Terms &amp; Conditions.
          </label>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!agreed || submitting}
            className="w-full bg-[#D4AF37] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {submitting ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
