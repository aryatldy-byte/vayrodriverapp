// ============================================
// Driver Document Upload Component
// Save as: components/driver/DocumentUpload.tsx
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import axios from 'axios';
import { supabase } from '@/lib/supabase/client';
import type { DocumentType } from '@/lib/types';
import { FiUploadCloud, FiCheck, FiX, FiLoader } from 'react-icons/fi';

interface DocumentUploadProps {
  driverId: string;
}

const REQUIRED_DOCUMENTS: Array<{
  type: DocumentType;
  label: string;
  description: string;
}> = [
  { type: 'license', label: 'Driving License', description: 'Valid driving license' },
  {
    type: 'police_clearance',
    label: 'Police Clearance',
    description: 'Police clearance certificate',
  },
  {
    type: 'address_proof',
    label: 'Address Proof',
    description: 'Any address proof (Aadhar, passport, utility bill)',
  },
];

/**
 * Driver Document Upload Component
 * Allows drivers to upload required documents (license, police clearance, address proof)
 */
export function DocumentUpload({ driverId }: DocumentUploadProps) {
  const router = useRouter();
  const [uploads, setUploads] = useState<Record<DocumentType, { file?: File; url?: string; status?: 'pending' | 'approved' | 'rejected' }>>({
    license: {},
    police_clearance: {},
    address_proof: {},
  });
  const [loading, setLoading] = useState<Partial<Record<DocumentType, boolean>>>({});
  const [allUploaded, setAllUploaded] = useState(false);

  const handleFileSelect = (documentType: DocumentType, file: File | undefined) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload PDF or image files only');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploads((prev) => ({
      ...prev,
      [documentType]: { file },
    }));
  };

  const handleUpload = async (documentType: DocumentType) => {
    const file = uploads[documentType].file;

    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setLoading((prev) => ({ ...prev, [documentType]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('driverId', driverId);

      const response = await axios.post('/api/drivers/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploads((prev) => ({
        ...prev,
        [documentType]: {
          file,
          url: response.data.document.document_url,
          status: 'pending',
        },
      }));

      toast.success(`${REQUIRED_DOCUMENTS.find((d) => d.type === documentType)?.label} uploaded`);

      // Check if all documents are uploaded
      const allDocs = Object.keys(uploads) as DocumentType[];
      const allUploadedDocs = allDocs.every(
        (doc) => uploads[doc].file || uploads[doc].url
      );
      setAllUploaded(allUploadedDocs);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setLoading((prev) => ({ ...prev, [documentType]: false }));
    }
  };

  const getStatusIcon = (documentType: DocumentType) => {
    const status = uploads[documentType].status;

    if (status === 'approved') {
      return <FiCheck className="text-green-600 text-xl" />;
    } else if (status === 'rejected') {
      return <FiX className="text-red-600 text-xl" />;
    } else if (uploads[documentType].url) {
      return <div className="text-yellow-600 text-xl font-bold">⏳</div>;
    }

    return null;
  };

  const handleContinue = async () => {
    if (!allUploaded) {
      toast.error('Please upload all required documents');
      return;
    }

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ documents_submitted_at: new Date().toISOString() })
        .eq('id', driverId);

      if (error) throw error;

      toast.success('All documents uploaded! Your account is pending verification.');
      router.push('/driver/dashboard');
    } catch (error) {
      console.error('Failed to mark documents submitted:', error);
      toast.error('Uploaded, but failed to update your status. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-vayroCard border border-vayroBorder rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-gray-400">Upload required documents to start accepting rides</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-gray-300">Documents Uploaded</span>
            <span className="text-sm font-semibold text-gray-300">
              {Object.values(uploads).filter((u) => u.file || u.url).length} / 3
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-vayroGold h-2 rounded-full transition-all"
              style={{
                width: `${
                  (Object.values(uploads).filter((u) => u.file || u.url).length / 3) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Document Upload Cards */}
        <div className="space-y-6 mb-8">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <div
              key={doc.type}
              className="border border-vayroBorder rounded-lg p-6 hover:border-vayroGold transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{doc.label}</h3>
                  <p className="text-sm text-gray-400 mt-1">{doc.description}</p>
                </div>
                {getStatusIcon(doc.type)}
              </div>

              {/* File Input */}
              <div className="mb-4">
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-vayroBorder rounded-lg p-6 hover:border-vayroGold transition text-center">
                    <FiUploadCloud className="mx-auto text-3xl text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-300">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG or PNG (Max 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileSelect(doc.type, e.target.files?.[0])}
                    className="hidden"
                    disabled={loading[doc.type]}
                  />
                </label>
              </div>

              {/* Selected File Info */}
              {(uploads[doc.type].file || uploads[doc.type].url) && (
                <div className="bg-vayroDark border border-vayroBorder rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-300">
                    📄{' '}
                    <span className="font-semibold">
                      {uploads[doc.type].file?.name || 'Document uploaded'}
                    </span>
                  </p>
                  {uploads[doc.type].status === 'pending' && (
                    <p className="text-xs text-yellow-600 mt-1">Waiting for admin review</p>
                  )}
                  {uploads[doc.type].status === 'approved' && (
                    <p className="text-xs text-green-600 mt-1">✓ Approved by admin</p>
                  )}
                  {uploads[doc.type].status === 'rejected' && (
                    <p className="text-xs text-red-600 mt-1">✗ Rejected - please reupload</p>
                  )}
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={() => handleUpload(doc.type)}
                disabled={loading[doc.type] || !uploads[doc.type].file}
                className="w-full bg-vayroGold hover:opacity-90 disabled:opacity-50 text-black font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading[doc.type] && <FiLoader className="animate-spin" />}
                {uploads[doc.type].url ? 'Reupload Document' : 'Upload Document'}
              </button>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-vayroDark border border-vayroBorder rounded-lg p-4 mb-8">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-vayroGold">ℹ️ Note:</span> Your documents will be reviewed by our admin team
            within 24 hours. You'll receive an email once your profile is approved.
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!allUploaded}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:bg-vayroBorder text-white font-semibold py-3 px-4 rounded-lg transition text-lg"
        >
          {allUploaded ? '✓ Continue to Dashboard' : 'Upload All Documents to Continue'}
        </button>
      </div>
    </div>
  );
}
