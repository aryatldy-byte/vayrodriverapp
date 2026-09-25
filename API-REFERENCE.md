# Vayro MVP - API Reference & Quick Start

Quick reference for all API endpoints and how to use them.

## Base URL

**Development:** `http://localhost:3000/api`  
**Production:** `https://your-app.vercel.app/api`

## Authentication

All authenticated endpoints require a valid Supabase session. The session is handled automatically by the Supabase client in the browser.

### Error Responses

All errors follow this format:

```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {}
}
```

---

## Authentication Endpoints

### Send OTP

**Endpoint:** `POST /auth/login`  
**Authentication:** None

**Request:**
```javascript
const { sendOTP } = require('@/lib/supabase/client');
await sendOTP('user@example.com');
```

**Response:**
```json
{
  "success": true,
  "data": { /* Supabase response */ }
}
```

**Status Codes:**
- `200` - OTP sent successfully
- `400` - Invalid email format
- `500` - Email service error

---

### Verify OTP

**Endpoint:** `POST /auth/verify`  
**Authentication:** None

**Request:**
```javascript
const { verifyOTP } = require('@/lib/supabase/client');
await verifyOTP('user@example.com', '123456');
```

**Response:**
```json
{
  "success": true,
  "user": { /* User object */ },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Status Codes:**
- `200` - Login successful
- `400` - Invalid OTP
- `401` - OTP expired
- `404` - User not found

---

### Logout

**Endpoint:** `POST /auth/logout`  
**Authentication:** Required

**Request:**
```javascript
const { logout } = require('@/lib/supabase/client');
await logout();
```

**Response:**
```json
{
  "success": true
}
```

---

### Get Current User

**Endpoint:** `GET /auth/me`  
**Authentication:** Required

**Request:**
```javascript
const { getCurrentUser } = require('@/lib/supabase/client');
const user = await getCurrentUser();
```

**Response:**
```json
{
  "id": "user-id-123",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "client",
  "status": "active"
}
```

---

## Client Booking Endpoints

### Create Booking

**Endpoint:** `POST /bookings/create`  
**Authentication:** Required (Client)

**Request:**
```javascript
const { data } = await axios.post('/api/bookings/create', {
  pickup_latitude: 12.9716,
  pickup_longitude: 77.5946,
  pickup_address: "123 Main Street, Bangalore",
  dropoff_latitude: 12.9352,
  dropoff_longitude: 77.6245,
  dropoff_address: "123 Park Avenue, Bangalore",
  booking_type: "instant", // or "scheduled"
  scheduled_at: "2024-12-25T14:00:00Z", // required if scheduled
  vehicle_type: "car", // "bike", "auto", "car", "suv"
  special_notes: "Please ring bell twice",
  payment_method: "cash" // "card", "wallet"
});
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "booking-id-123",
    "client_id": "client-id",
    "status": "searching",
    "distance_km": 5.2,
    "estimated_fare": 156,
    "pickup_address": "123 Main Street, Bangalore",
    "dropoff_address": "123 Park Avenue, Bangalore",
    "created_at": "2024-12-20T10:30:00Z"
  },
  "availableDriversCount": 3
}
```

**Status Codes:**
- `201` - Booking created
- `400` - Invalid data
- `401` - Unauthorized
- `404` - Client profile not found

---

### Get Client Bookings

**Endpoint:** `GET /bookings?page=1&limit=10`  
**Authentication:** Required (Client)

**Request:**
```javascript
const { data } = await axios.get('/api/bookings?page=1&limit=10');
```

**Response:**
```json
{
  "data": [
    {
      "id": "booking-id",
      "status": "completed",
      "distance_km": 5.2,
      "actual_fare": 160,
      "client_rating": 5,
      "created_at": "2024-12-20T10:30:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

---

### Cancel Booking

**Endpoint:** `PATCH /bookings/:bookingId/cancel`  
**Authentication:** Required (Client)

**Request:**
```javascript
await axios.patch('/api/bookings/booking-123/cancel', {
  reason: "Driver taking too long"
});
```

**Response:**
```json
{
  "success": true,
  "booking": { /* Updated booking */ }
}
```

**Status Codes:**
- `200` - Booking cancelled
- `400` - Cannot cancel (ride already started)
- `404` - Booking not found

---

### Rate Ride

**Endpoint:** `POST /bookings/:bookingId/rate`  
**Authentication:** Required

**Request:**
```javascript
await axios.post('/api/bookings/booking-123/rate', {
  rating: 5,
  review: "Great driver, safe and comfortable",
  role: "client" // or "driver"
});
```

**Response:**
```json
{
  "success": true,
  "booking": { /* Updated booking */ }
}
```

---

## Driver Endpoints

### Update Driver Profile

**Endpoint:** `PATCH /drivers/profile`  
**Authentication:** Required (Driver)

**Request:**
```javascript
await axios.patch('/api/drivers/profile', {
  vehicle_type: "car",
  vehicle_registration: "KA01AB1234",
  vehicle_color: "Black",
  vehicle_model: "Hyundai i20",
  bank_account_number: "1234567890",
  bank_ifsc: "SBIN0000001"
});
```

**Response:**
```json
{
  "success": true,
  "driver": { /* Updated driver profile */ }
}
```

---

### Upload Document

**Endpoint:** `POST /drivers/documents/upload`  
**Authentication:** Required (Driver)

**Request:**
```javascript
const formData = new FormData();
formData.append('file', fileObject);
formData.append('documentType', 'license'); // license, police_clearance, address_proof

await axios.post('/api/drivers/documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "doc-id",
    "document_type": "license",
    "document_url": "https://...",
    "uploaded_at": "2024-12-20T10:30:00Z"
  }
}
```

**Status Codes:**
- `201` - Document uploaded
- `400` - Invalid file type/size
- `401` - Unauthorized
- `413` - File too large

---

### Toggle Availability

**Endpoint:** `PATCH /drivers/availability`  
**Authentication:** Required (Driver)

**Request:**
```javascript
await axios.patch('/api/drivers/availability', {
  is_available: true
});
```

**Response:**
```json
{
  "success": true,
  "driver": { /* Updated driver profile */ }
}
```

---

### Accept Ride

**Endpoint:** `POST /drivers/rides/accept`  
**Authentication:** Required (Driver)

**Request:**
```javascript
await axios.post('/api/drivers/rides/accept', {
  booking_id: "booking-123"
});
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "booking-123",
    "driver_id": "driver-id",
    "status": "accepted",
    "client_phone": "+919876543210"
  },
  "message": "Ride accepted successfully"
}
```

**Status Codes:**
- `200` - Ride accepted
- `400` - Booking no longer available
- `403` - Driver not approved
- `404` - Booking not found

---

### Update Location

**Endpoint:** `PATCH /drivers/location`  
**Authentication:** Required (Driver)

**Request:**
```javascript
await axios.patch('/api/drivers/location', {
  booking_id: "booking-123",
  latitude: 12.9516,
  longitude: 77.6412
});
```

**Response:**
```json
{
  "success": true,
  "update": {
    "booking_id": "booking-123",
    "driver_latitude": 12.9516,
    "driver_longitude": 77.6412,
    "status": "driver_arriving"
  }
}
```

---

## Admin Endpoints

### Get Pending Drivers

**Endpoint:** `GET /admin/drivers?status=pending`  
**Authentication:** Required (Admin)

**Request:**
```javascript
const { data } = await axios.get('/api/admin/drivers?status=pending');
```

**Response:**
```json
{
  "data": [
    {
      "id": "driver-id",
      "user_id": "user-id",
      "approval_status": "pending",
      "documents_count": 3,
      "created_at": "2024-12-20T10:30:00Z"
    }
  ],
  "total": 12
}
```

---

### Get Driver Documents

**Endpoint:** `GET /admin/drivers/:driverId/documents`  
**Authentication:** Required (Admin)

**Request:**
```javascript
const { data } = await axios.get('/api/admin/drivers/driver-123/documents');
```

**Response:**
```json
{
  "data": [
    {
      "id": "doc-id",
      "document_type": "license",
      "document_url": "https://...",
      "uploaded_at": "2024-12-20T10:30:00Z",
      "review": null
    }
  ]
}
```

---

### Approve Driver

**Endpoint:** `POST /admin/drivers/approve`  
**Authentication:** Required (Admin)

**Request:**
```javascript
await axios.post('/api/admin/drivers/approve', {
  driver_id: "driver-123"
});
```

**Response:**
```json
{
  "success": true,
  "driver": {
    "id": "driver-123",
    "approval_status": "approved",
    "approved_at": "2024-12-20T10:30:00Z"
  },
  "message": "Driver approved successfully"
}
```

**Status Codes:**
- `200` - Driver approved
- `400` - Missing required documents
- `403` - Not all documents approved
- `404` - Driver not found

---

### Reject Driver

**Endpoint:** `PUT /admin/drivers/approve`  
**Authentication:** Required (Admin)

**Request:**
```javascript
await axios.put('/api/admin/drivers/approve', {
  driver_id: "driver-123",
  rejection_reason: "License expired"
});
```

**Response:**
```json
{
  "success": true,
  "driver": {
    "id": "driver-123",
    "approval_status": "rejected",
    "rejection_reason": "License expired"
  }
}
```

---

### Manually Assign Ride

**Endpoint:** `POST /admin/bookings/:bookingId/assign`  
**Authentication:** Required (Admin)

**Request:**
```javascript
await axios.post('/api/admin/bookings/booking-123/assign', {
  driver_id: "driver-456"
});
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "booking-123",
    "driver_id": "driver-456",
    "status": "accepted"
  }
}
```

---

### Get Dashboard Analytics

**Endpoint:** `GET /admin/analytics`  
**Authentication:** Required (Admin)

**Request:**
```javascript
const { data } = await axios.get('/api/admin/analytics');
```

**Response:**
```json
{
  "total_users": 250,
  "total_drivers": 45,
  "pending_drivers": 8,
  "total_bookings": 1250,
  "completed_bookings": 1180,
  "total_revenue": 125000,
  "average_rating": 4.6
}
```

---

## Real-time Subscriptions

### Subscribe to Booking Updates

```javascript
import { subscribeToBooking } from '@/lib/supabase/client';

const subscription = subscribeToBooking('booking-123', (payload) => {
  console.log('Booking updated:', payload);
});

// Cleanup
subscription.unsubscribe();
```

### Subscribe to Ride Location Updates

```javascript
import { subscribeToRideUpdates } from '@/lib/supabase/client';

const subscription = subscribeToRideUpdates('booking-123', (payload) => {
  console.log('Driver location:', {
    latitude: payload.new.driver_latitude,
    longitude: payload.new.driver_longitude
  });
});
```

### Subscribe to Driver Status

```javascript
import { subscribeToDriverStatus } from '@/lib/supabase/client';

const subscription = subscribeToDriverStatus('driver-123', (payload) => {
  console.log('Driver availability:', payload.new.is_available);
});
```

---

## Error Codes Reference

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_EMAIL | 400 | Email format invalid |
| OTP_EXPIRED | 401 | OTP token has expired |
| UNAUTHORIZED | 401 | No valid session |
| FORBIDDEN | 403 | User doesn't have permission |
| NOT_FOUND | 404 | Resource doesn't exist |
| CONFLICT | 409 | Resource already exists |
| VALIDATION_ERROR | 422 | Input validation failed |
| SERVER_ERROR | 500 | Internal server error |

---

## Rate Limiting

Currently no rate limiting is implemented. In production, add:

```javascript
// Example: 100 requests per minute per IP
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // max 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Testing with cURL

### Send OTP
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

### Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "pickup_latitude": 12.9716,
    "pickup_longitude": 77.5946,
    "pickup_address": "123 Main St",
    "dropoff_latitude": 12.9352,
    "dropoff_longitude": 77.6245,
    "dropoff_address": "456 Park Ave",
    "vehicle_type": "car",
    "payment_method": "cash"
  }'
```

### Accept Ride
```bash
curl -X POST http://localhost:3000/api/drivers/rides/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"booking_id":"booking-123"}'
```

---

## WebSocket Events (Real-time)

### Booking Status Changed
```javascript
{
  "type": "booking:updated",
  "data": {
    "id": "booking-123",
    "status": "accepted",
    "driver_id": "driver-456"
  },
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### Driver Location Updated
```javascript
{
  "type": "ride:location",
  "data": {
    "booking_id": "booking-123",
    "driver_latitude": 12.9516,
    "driver_longitude": 77.6412,
    "eta_seconds": 120
  },
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### Driver Status Changed
```javascript
{
  "type": "driver:status",
  "data": {
    "driver_id": "driver-456",
    "is_available": true,
    "rating": 4.8
  },
  "timestamp": "2024-12-20T10:30:00Z"
}
```

---

## Pagination

All list endpoints support pagination:

```javascript
// Default pagination
const { data: page1 } = await axios.get('/api/bookings');

// Custom pagination
const { data: page2 } = await axios.get('/api/bookings?page=2&limit=20');
```

Response includes:
- `data` - Array of items
- `total` - Total number of items
- `page` - Current page number
- `limit` - Items per page
- `totalPages` - Total number of pages

---

## File Upload Limits

- **Max File Size:** 5 MB
- **Allowed Types:** PDF, JPG, JPEG, PNG
- **Storage Bucket:** `driver-documents`

---

## Rate Limiting (To be implemented)

- **Authentication:** 10 requests per minute
- **Booking Creation:** 30 requests per hour per user
- **Document Upload:** 5 files per hour per user
- **General API:** 100 requests per minute per IP

---

## API Security

- All endpoints over HTTPS in production
- JWT token validation on all protected routes
- RLS policies enforce data isolation
- SQL injection prevention via parameterized queries
- CORS configured for allowed domains
- CSRF protection on state-changing operations

---

## Support

For API issues:
1. Check the error response message and code
2. Verify authentication token is valid
3. Check browser console for CORS errors
4. Review Supabase logs for database errors
5. Test with cURL to isolate frontend issues
