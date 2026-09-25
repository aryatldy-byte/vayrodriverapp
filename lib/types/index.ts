// ============================================
// TypeScript Types & Interfaces
// Save as: lib/types/index.ts
// ============================================

/**
 * User Types
 */
export type UserRole = 'client' | 'driver' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'banned';

export interface User {
  id: string;
  auth_id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  profile_photo_url?: string;
  role: UserRole;
  status: UserStatus;
  has_password?: boolean;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  /** Whether this user has accepted the current Terms & Conditions. Defaults to false in the DB. */
  terms_accepted?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Driver Types
 */
export type VehicleType = 'manual' | 'automatic' | 'luxury' | 'electric';
export type DriverApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type DocumentType = 'license' | 'police_clearance' | 'address_proof';
export type DocumentReviewStatus = 'approved' | 'rejected';

export interface Driver {
  id: string;
  user_id: string;
  license_number: string;
  license_expiry?: string;
  vehicle_type: VehicleType;
  vehicle_registration?: string;
  vehicle_color?: string;
  vehicle_model?: string;
  is_available: boolean;
  approval_status: DriverApprovalStatus;
  rating: number;
  total_rides: number;
  total_earnings: number;
  bank_account_number?: string;
  bank_ifsc?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  documents_submitted_at?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface RideDocument {
  id: string;
  driver_id: string;
  document_type: DocumentType;
  document_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  uploaded_at: string;
}

export interface DocumentReview {
  id: string;
  document_id: string;
  admin_id: string;
  status: DocumentReviewStatus;
  comments?: string;
  reviewed_at: string;
}

/**
 * Booking Types
 */
export type BookingType = 'instant' | 'scheduled';
export type ServiceType = 'ride' | 'hire';
export type HireType = 'hourly' | 'daily';
export type BookingStatus = 'searching' | 'accepted' | 'driver_arriving' | 'started' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'wallet';
export type PaymentStatus = 'pending' | 'completed' | 'failed';
export type CancelledBy = 'client' | 'driver' | 'admin';

export interface Booking {
  id: string;
  client_id: string;
  driver_id?: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  dropoff_address?: string;
  scheduled_at?: string;
  booking_type: BookingType;
  service_type: ServiceType;
  vehicle_type?: VehicleType;
  hire_type?: HireType;
  hire_duration_hours?: number;
  night_booking?: boolean;
  status: BookingStatus;
  distance_km?: number;
  estimated_fare?: number;
  actual_fare?: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  special_notes?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_by?: CancelledBy;
  cancellation_reason?: string;
  cancelled_at?: string;
  client_rating?: number;
  client_review?: string;
  driver_rating?: number;
  driver_review?: string;
  created_at: string;
  updated_at: string;
  // Populated only when explicitly joined (e.g. BookingsManager's admin
  // query) — not present on a plain `select('*')`.
  driver?: {
    id: string;
    vehicle_type: VehicleType;
    users?: { first_name?: string; last_name?: string };
  } | null;
  client?: { first_name?: string; last_name?: string; phone?: string } | null;
}

export interface RideUpdate {
  id: string;
  booking_id: string;
  driver_latitude: number;
  driver_longitude: number;
  status: BookingStatus;
  eta_seconds?: number;
  distance_from_pickup_meters?: number;
  created_at: string;
}

/**
 * Pricing Types
 */
export interface PricingRule {
  id: string;
  vehicle_type: VehicleType;
  base_fare: number;
  per_km_fare: number;
  per_minute_fare: number;
  minimum_fare: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
export interface HirePricingRule {
  id: string;
  hourly_rate: number;
  minimum_charge: number;
  daily_charge: number;
  night_allowance: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}


/**
 * API Request/Response Types
 */
export interface LoginRequest {
  email: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
  };
}

export interface CreateBookingRequest {
  service_type: ServiceType;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  dropoff_address?: string;
  booking_type: BookingType;
  scheduled_at?: string;
  vehicle_type: VehicleType;
  special_notes?: string;
  payment_method: PaymentMethod;
  hire_type?: HireType;
  hire_duration_hours?: number;
  night_booking?: boolean;
}

export interface AcceptRideRequest {
  booking_id: string;
}

export interface UpdateLocationRequest {
  booking_id: string;
  latitude: number;
  longitude: number;
}

export interface CompleteRideRequest {
  booking_id: string;
  rating?: number;
  review?: string;
  actual_fare: number;
}

export interface RateRideRequest {
  booking_id: string;
  rating: number;
  review?: string;
  role: 'client' | 'driver';
}

export interface DriverUpdateRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  vehicle_type?: VehicleType;
  vehicle_registration?: string;
  vehicle_color?: string;
  vehicle_model?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface DocumentUploadRequest {
  document_type: DocumentType;
  file: File;
}

export interface AdminApproveDriverRequest {
  driver_id: string;
}

export interface AdminRejectDriverRequest {
  driver_id: string;
  rejection_reason: string;
}

export interface AdminAssignRideRequest {
  booking_id: string;
  driver_id: string;
}

/**
 * Location Types
 */
export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * UI Component Props
 */
export interface MapProps {
  center?: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (markerId: string) => void;
  height?: string;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  label?: string;
  color?: 'red' | 'blue' | 'green' | 'yellow';
}

/**
 * Real-time Event Types
 */
export type RealtimeEventType = 'booking:updated' | 'ride:location' | 'driver:status' | 'document:reviewed';

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: any;
  timestamp: string;
}

/**
 * Dashboard Analytics Types
 */
export interface DashboardStats {
  total_users: number;
  total_drivers: number;
  pending_drivers: number;
  total_bookings: number;
  completed_bookings: number;
  total_revenue: number;
  average_rating: number;
}

export interface DriverStats {
  total_rides: number;
  completed_rides: number;
  cancelled_rides: number;
  total_earnings: number;
  average_rating: number;
  response_rate: number;
}

export interface ClientStats {
  total_rides: number;
  completed_rides: number;
  cancelled_rides: number;
  total_spent: number;
  average_rating: number;
}

/**
 * Error Types
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  details?: any;
}

/**
 * Form Validation Types
 */
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'file';
  placeholder?: string;
  required?: boolean;
  pattern?: RegExp;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  minLength?: number;
  accept?: string;
}

/**
 * Toast/Notification Types
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

/**
 * Pagination Types
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Filter Types
 */
export interface BookingFilters {
  status?: BookingStatus;
  dateFrom?: string;
  dateTo?: string;
  vehicleType?: VehicleType;
  minRating?: number;
}

export interface DriverFilters {
  approvalStatus?: DriverApprovalStatus;
  vehicleType?: VehicleType;
  minRating?: number;
  isAvailable?: boolean;
}
