// ============================================
// Admin Driver Verification Component
// Save as: components/admin/DriverVerification.tsx
// ============================================

'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { supabase, getDocumentReviews } from '@/lib/supabase/client';
import type { Driver, RideDocument } from '@/lib/types';
import { FiCheck, FiX, FiEye, FiLoader } from 'react-icons/fi';

const REQUIRED_DOCUMENT_TYPES = ['license', 'police_clearance', 'address_proof'];

const STATUS_TABS: { value: Driver['approval_status']; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

/**
 * Admin Driver Verification Component
 * Lets an admin browse drivers by approval status (pending / approved /
 * rejected / suspended) and, for pending drivers, review documents and
 * approve or reject them.
 */
export function DriverVerification() {
  const [statusTab, setStatusTab] = useState<Driver['approval_status']>('pending');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [documents, setDocuments] = useState<RideDocument[]>([]);
  const [reviews, setReviews] = useState<Record<string, any>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});

  // Fetch drivers for whichever status tab is selected. Approved drivers
  // used to be invisible once approved — this only ever queried
  // 'pending' — so a tab switch is what makes them findable again.
  useEffect(() => {
    setSelectedDriver(null);

    const fetchDrivers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('*, users:user_id(*)')
          .eq('approval_status', statusTab)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDrivers(data || []);
      } catch (error) {
        console.error('Fetch drivers error:', error);
        toast.error('Failed to load drivers');
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();

    // Refetch on ANY driver change, not just updates matching the current
    // tab's filter — a driver moving pending -> approved changes its
    // status to something the filter no longer matches, so a narrower
    // filter here would miss exactly the transition we care about.
    const subscription = supabase
      .channel(`drivers_${statusTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        fetchDrivers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [statusTab]);

  // Fetch documents for selected driver
  useEffect(() => {
    if (!selectedDriver) return;

    const fetchDocuments = async () => {
      try {
        const { data, error } = await supabase
          .from('ride_documents')
          .select('*')
          .eq('driver_id', selectedDriver.id);

        if (error) throw error;
        const docs = data || [];
        setDocuments(docs);
        setReviews(await getDocumentReviews(docs.map((d) => d.id)));
      } catch (error) {
        console.error('Fetch documents error:', error);
        toast.error('Failed to load documents');
      }
    };

    fetchDocuments();
  }, [selectedDriver]);

  // Approve or reject a single document. This is what actually creates
  // the ride_documents_reviews rows that /api/admin/drivers/approve
  // checks before it will let the driver as a whole be approved.
  const handleReviewDocument = async (documentId: string, status: 'approved' | 'rejected') => {
    setReviewLoading((prev) => ({ ...prev, [documentId]: true }));
    try {
      const response = await axios.post('/api/admin/documents/review', {
        document_id: documentId,
        status,
      });
      setReviews((prev) => ({ ...prev, [documentId]: response.data.review }));
      toast.success(status === 'approved' ? 'Document approved' : 'Document rejected');
    } catch (error: any) {
      console.error('Review document error:', error);
      toast.error(error.response?.data?.error || 'Failed to save review');
    } finally {
      setReviewLoading((prev) => ({ ...prev, [documentId]: false }));
    }
  };

  // Mirrors the server-side check in /api/admin/drivers/approve: every
  // required document type must be uploaded AND reviewed as approved.
  const missingOrUnapproved = REQUIRED_DOCUMENT_TYPES.filter((type) => {
    const doc = documents.find((d) => d.document_type === type);
    if (!doc) return true;
    return reviews[doc.id]?.status !== 'approved';
  });
  const canApproveDriver = missingOrUnapproved.length === 0;

  // Approve driver
  const handleApproveDriver = async (driverId: string) => {
    setActionLoading((prev) => ({ ...prev, [driverId]: true }));
    try {
      const response = await axios.post('/api/admin/drivers/approve', {
        driver_id: driverId,
      });

      toast.success('Driver approved successfully');
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      setSelectedDriver(null);
    } catch (error: any) {
      console.error('Approve error:', error);
      toast.error(error.response?.data?.error || 'Failed to approve driver');
    } finally {
      setActionLoading((prev) => ({ ...prev, [driverId]: false }));
    }
  };

  // Reject driver
  const handleRejectDriver = async (driverId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActionLoading((prev) => ({ ...prev, [driverId]: true }));
    try {
      const response = await axios.put('/api/admin/drivers/approve', {
        driver_id: driverId,
        rejection_reason: rejectionReason,
      });

      toast.success('Driver rejected');
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      setSelectedDriver(null);
      setRejectionReason('');
    } catch (error: any) {
      console.error('Reject error:', error);
      toast.error(error.response?.data?.error || 'Failed to reject driver');
    } finally {
      setActionLoading((prev) => ({ ...prev, [driverId]: false }));
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Driver List (by status) */}
      <div className="lg:col-span-1">
        <div className="bg-vayroCard border border-vayroBorder rounded-lg shadow-lg">
          <div className="p-4 border-b border-vayroBorder flex flex-wrap gap-2">
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
          <div className="p-4 border-b border-vayroBorder">
            <h2 className="text-lg font-bold text-white">
              {STATUS_TABS.find((t) => t.value === statusTab)?.label} Drivers ({drivers.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <FiLoader className="animate-spin text-2xl text-vayroGold" />
            </div>
          ) : drivers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-400">No {statusTab} drivers</p>
            </div>
          ) : (
            <div className="divide-y divide-vayroBorder max-h-96 overflow-y-auto">
              {drivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver)}
                  className={`w-full text-left p-4 hover:bg-vayroDark transition ${
                    selectedDriver?.id === driver.id ? 'bg-vayroGold/10 border-l-4 border-vayroGold' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-white">
                        {(driver as any).users?.first_name || 'Unknown'}{' '}
                        {(driver as any).users?.last_name}
                      </p>
                      {driver.approval_status === 'approved' && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            driver.is_available
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {driver.is_available ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      License: {driver.license_number}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(driver.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Driver Details & Document Review */}
      <div className="lg:col-span-2">
        {selectedDriver ? (
          <div className="bg-vayroCard border border-vayroBorder rounded-lg shadow-lg">
            {/* Driver Info */}
            <div className="p-6 border-b border-vayroBorder">
              <h3 className="text-2xl font-bold text-white mb-4">
                {(selectedDriver as any).users?.first_name}{' '}
                {(selectedDriver as any).users?.last_name}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">License Number</p>
                  <p className="font-semibold text-white">
                    {selectedDriver.license_number}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Vehicle Type</p>
                  <p className="font-semibold text-white capitalize">
                    {selectedDriver.vehicle_type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="font-semibold text-white">
                    {(selectedDriver as any).users?.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Phone</p>
                  <p className="font-semibold text-white">
                    {(selectedDriver as any).users?.phone || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="p-6 border-b border-vayroBorder">
              <h4 className="text-lg font-semibold text-white mb-4">Documents</h4>

              {documents.length === 0 ? (
                <p className="text-gray-400">No documents uploaded</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const review = reviews[doc.id];
                    const isLoading = !!reviewLoading[doc.id];
                    return (
                      <div key={doc.id} className="p-3 bg-vayroDark rounded-lg">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-white capitalize">
                              {doc.document_type.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                                review?.status === 'approved'
                                  ? 'bg-green-500/20 text-green-400'
                                  : review?.status === 'rejected'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-vayroGold/20 text-vayroGold'
                              }`}
                            >
                              {review?.status || 'Not reviewed'}
                            </span>
                            <a
                              href={doc.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-vayroGold hover:opacity-80"
                              title="View document"
                            >
                              <FiEye className="text-xl" />
                            </a>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          {selectedDriver.approval_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleReviewDocument(doc.id, 'approved')}
                                disabled={isLoading || review?.status === 'approved'}
                                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-3 rounded-md bg-green-600/90 hover:bg-green-600 disabled:opacity-40 text-white transition"
                              >
                                {isLoading ? <FiLoader className="animate-spin" /> : <FiCheck />}
                                Approve doc
                              </button>
                              <button
                                onClick={() => handleReviewDocument(doc.id, 'rejected')}
                                disabled={isLoading || review?.status === 'rejected'}
                                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-3 rounded-md bg-red-600/90 hover:bg-red-600 disabled:opacity-40 text-white transition"
                              >
                                {isLoading ? <FiLoader className="animate-spin" /> : <FiX />}
                                Reject doc
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!canApproveDriver && selectedDriver.approval_status === 'pending' && (
                <p className="text-xs text-gray-500 mt-4">
                  Every required document (license, police clearance, address proof) must be
                  uploaded and approved above before this driver can be approved.
                </p>
              )}
            </div>

            {selectedDriver.approval_status === 'pending' ? (
              <>
                {/* Rejection Reason */}
                <div className="p-6 border-b border-vayroBorder">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rejection Reason (if rejecting)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Specify reason for rejection if needed..."
                    maxLength={500}
                    className="w-full px-4 py-2 bg-vayroDark border border-vayroBorder text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vayroGold resize-none"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="p-6 flex gap-3">
                  <button
                    onClick={() => handleApproveDriver(selectedDriver.id)}
                    disabled={actionLoading[selectedDriver.id] || !canApproveDriver}
                    title={!canApproveDriver ? 'Approve every required document first' : undefined}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {actionLoading[selectedDriver.id] && (
                      <FiLoader className="animate-spin" />
                    )}
                    <FiCheck />
                    Approve Driver
                  </button>
                  <button
                    onClick={() => handleRejectDriver(selectedDriver.id)}
                    disabled={actionLoading[selectedDriver.id]}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    {actionLoading[selectedDriver.id] && (
                      <FiLoader className="animate-spin" />
                    )}
                    <FiX />
                    Reject Driver
                  </button>
                </div>
              </>
            ) : (
              <div className="p-6">
                <span
                  className={`inline-block text-sm font-semibold px-3 py-1 rounded-full capitalize ${
                    selectedDriver.approval_status === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : selectedDriver.approval_status === 'rejected'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {selectedDriver.approval_status}
                </span>
                {selectedDriver.rejection_reason && (
                  <p className="text-sm text-gray-400 mt-3">
                    Reason: {selectedDriver.rejection_reason}
                  </p>
                )}
                {selectedDriver.approval_status === 'approved' && selectedDriver.approved_at && (
                  <p className="text-sm text-gray-400 mt-3">
                    Approved on {new Date(selectedDriver.approved_at).toLocaleDateString()} — currently{' '}
                    {selectedDriver.is_available ? 'online' : 'offline'}.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-vayroCard border border-vayroBorder rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-400">Select a driver to view details and documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
