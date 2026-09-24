# Vayro Driver + Admin App

Covers driver OTP login and the admin dashboard (email/password login). See SETUP-GUIDE.md to get started — there's a companion `vayro-client` app for riders, sharing the same Supabase backend.


## Architecture Overview

```
┌─────────────────┐
│   Next.js       │  (Frontend + API Routes)
│  (Vercel)       │
└────────┬────────┘
         │
    ┌────┴─────────────────────┐
    │                           │
┌───▼────────────┐    ┌────────▼────┐
│  Supabase      │    │  Google     │
│  (Auth, DB)    │    │  Maps API   │
└────────────────┘    └─────────────┘
```

## Project Structure

```
vayro/
├── app/
│   ├── (auth)/
│   │   └── login/                    # OTP Login page
│   ├── (client)/
│   │   ├── dashboard/               # Client dashboard
│   │   ├── book-ride/               # Booking flow
│   │   └── my-rides/                # Ride history
│   ├── (driver)/
│   │   ├── dashboard/               # Driver dashboard
│   │   ├── documents/               # Document upload
│   │   └── available-rides/         # Ride acceptance
│   ├── (admin)/
│   │   ├── dashboard/               # Admin overview
│   │   ├── drivers/                 # Driver verification
│   │   └── bookings/                # Booking management
│   ├── api/
│   │   ├── auth/                    # Auth endpoints
│   │   ├── rides/                   # Ride CRUD
│   │   ├── drivers/                 # Driver management
│   │   ├── bookings/                # Booking operations
│   │   └── admin/                   # Admin operations
│   └── layout.tsx
├── components/
│   ├── shared/
│   │   ├── Map.tsx                  # Google Map component
│   │   ├── Header.tsx
│   │   └── Loader.tsx
│   ├── auth/
│   │   └── OTPForm.tsx
│   ├── client/
│   │   ├── RideBookingForm.tsx
│   │   ├── RideCard.tsx
│   │   └── MapWithPickup.tsx
│   ├── driver/
│   │   ├── DocumentUpload.tsx
│   │   ├── AvailabilityToggle.tsx
│   │   └── RideRequest.tsx
│   └── admin/
│       ├── DriverVerification.tsx
│       ├── DocumentViewer.tsx
│       └── ManualRideAssignment.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase client
│   │   ├── server.ts               # Server-side Supabase
│   │   └── schema.sql              # Database schema
│   ├── utils/
│   │   ├── auth.ts                 # Auth helpers
│   │   ├── validation.ts           # Form validation
│   │   └── distance.ts             # Distance calculations
│   └── types/
│       └── index.ts                # TypeScript types
├── hooks/
│   ├── useAuth.ts
│   ├── useLocationTracking.ts
│   └── useRealtime.ts
├── public/
│   └── icons/
├── .env.local.example
├── package.json
├── tsconfig.json
├── next.config.js
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context + Hooks
- **Real-time**: Supabase Real-time subscriptions
- **Authentication**: Supabase Auth (OTP)
- **Database**: PostgreSQL (Supabase)
- **Maps**: Google Maps JavaScript API
- **File Storage**: Supabase Storage
- **Deployment**: Vercel (frontend), Supabase (backend)

## Features

### Client
- ✅ OTP-based login (mobile/email)
- ✅ Book instant rides or schedule for later
- ✅ Real-time driver location tracking
- ✅ Ride status updates
- ✅ Ride history and ratings
- ✅ Payment integration ready

### Driver
- ✅ Document upload (license, clearance, address proof)
- ✅ Profile verification status
- ✅ Toggle availability on/off
- ✅ Accept/reject ride requests
- ✅ Real-time ride notifications
- ✅ Earnings tracking

### Admin
- ✅ Driver document verification dashboard
- ✅ Approve/reject driver applications
- ✅ Manual ride assignment
- ✅ Real-time dashboard with KPIs
- ✅ Client and driver management
- ✅ Booking analytics

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)
- Google Maps API key
- Vercel account (for deployment)

## Setup Instructions

### 1. Clone & Install Dependencies
```bash
git clone <repo>
cd vayro
npm install
```

### 2. Supabase Setup
```bash
# Create account at https://supabase.com
# Create new project
# Copy project URL and anon key

# Create database tables (SQL from lib/supabase/schema.sql)
# - users
# - drivers
# - bookings
# - ride_documents
# - ride_documents_reviews
```

### 3. Environment Configuration
```bash
cp .env.local.example .env.local

# Fill in:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
```

### 4. Enable Supabase Features
- **Auth**: Enable OTP provider (Email & SMS)
- **Storage**: Create bucket `driver-documents`
- **Real-time**: Enable for tables: bookings, drivers, ride_updates

### 5. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### 6. Deploy to Vercel
```bash
vercel
# Connect Git repository
# Set environment variables in Vercel dashboard
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Initiate OTP login
- `POST /api/auth/verify` - Verify OTP token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Client Rides
- `POST /api/bookings/create` - Create new booking
- `GET /api/bookings` - Get user bookings
- `PATCH /api/bookings/:id/cancel` - Cancel booking
- `POST /api/bookings/:id/rate` - Rate ride

### Driver Management
- `PATCH /api/drivers/profile` - Update driver profile
- `POST /api/drivers/documents/upload` - Upload documents
- `PATCH /api/drivers/availability` - Toggle availability
- `POST /api/drivers/rides/:id/accept` - Accept ride request
- `PATCH /api/drivers/location` - Update real-time location

### Admin Operations
- `GET /api/admin/drivers` - List all drivers
- `PATCH /api/admin/drivers/:id/approve` - Approve driver
- `PATCH /api/admin/drivers/:id/reject` - Reject driver
- `POST /api/admin/bookings/:id/assign` - Manually assign ride
- `GET /api/admin/analytics` - Get dashboard metrics

## Database Schema

See `lib/supabase/schema.sql` for complete schema with:
- RLS (Row Level Security) policies
- Triggers for auto-timestamps
- Indexes for performance
- Foreign key relationships

Key tables:
- `users` - All users (client, driver, admin)
- `drivers` - Driver profiles with verification status
- `ride_documents` - Document uploads
- `ride_documents_reviews` - Admin reviews
- `bookings` - Ride bookings
- `ride_updates` - Real-time ride status

## Security Features

- ✅ RLS policies on all tables
- ✅ JWT-based authentication
- ✅ Environment variable protection
- ✅ Rate limiting (ready to add)
- ✅ Input validation on all endpoints
- ✅ Secure file upload with signed URLs

## Performance Optimizations

- ✅ Next.js Image optimization
- ✅ Server-side rendering where needed
- ✅ Client-side caching with React Query (ready)
- ✅ Database query optimization with indexes
- ✅ CDN for static assets (Vercel)

## Development Workflow

```bash
# Start dev server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Deploy to Vercel
git push origin main
```

## Testing Scenarios

### Client Flow
1. Login with OTP → Dashboard
2. Book ride (now/scheduled) → Confirm → Track driver
3. Rate ride → Add feedback

### Driver Flow
1. Login → Upload documents (3 docs required)
2. Admin approves → Toggle availability
3. Accept ride notification → Start ride → Complete

### Admin Flow
1. Login → Review driver docs
2. Approve/reject driver
3. Manually assign ride if needed
4. Monitor analytics

## Common Issues & Solutions

**Issue**: Maps not showing
- Solution: Verify Google Maps API key, enable Maps JavaScript API

**Issue**: Real-time updates not working
- Solution: Check Supabase Real-time enabled on table, verify RLS policies

**Issue**: File upload fails
- Solution: Check Storage bucket permissions, verify file size limits

## Next Steps for Production

- [ ] Add payment processing (Stripe/Razorpay)
- [ ] Implement ride rating system
- [ ] Add push notifications (FCM)
- [ ] Implement surge pricing
- [ ] Add multiple language support
- [ ] Implement user analytics
- [ ] Add automated driver verification (Aadhar API)
- [ ] Implement trip insurance
- [ ] Add emergency SOS feature
- [ ] Set up monitoring and logging

## Support & Resources

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Google Maps: https://developers.google.com/maps/documentation
- Tailwind CSS: https://tailwindcss.com/docs

## License

MIT
