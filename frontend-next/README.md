# Teeem Frontend (Next.js)

Modern Next.js frontend for Teeem construction management platform.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: Tailwind CSS + Radix UI + shadcn/ui components
- **State**: React Context + Jotai atoms
- **Auth**: JWT tokens with Rails backend

## Getting Started

### Prerequisites

- Node.js 18+
- Rails backend running on port 3000

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server (runs on port 3001 by default if 3000 is taken)
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Rails backend URL | `http://localhost:3000` |
| `NEXT_PUBLIC_DEV_MODE_AUTH_BYPASS` | Skip auth for UI testing | `false` |

## Project Structure

```
frontend-next/
├── app/                    # Next.js App Router pages
│   ├── (app)/              # Authenticated app routes
│   │   ├── dashboard/
│   │   ├── jobs/
│   │   ├── contacts/
│   │   ├── purchase-orders/
│   │   ├── meetings/
│   │   ├── whs/
│   │   ├── financial/
│   │   └── settings/
│   ├── (auth)/             # Login/signup pages
│   └── (marketing)/        # Public landing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── ...                 # Feature components
├── contexts/               # React contexts (Auth)
├── lib/                    # Utilities (api client, utils)
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript definitions
```

## Key Features

- **Dashboard**: Overview stats, recent activity, quick actions
- **Jobs**: Project management with WHS integration
- **Contacts**: Customer/supplier management with duplicate detection
- **Purchase Orders**: PO creation and tracking
- **Meetings**: Schedule site and virtual meetings
- **WHS**: Safety incidents, inspections, SWMS, inductions
- **Financial**: Reports and Xero integration
- **Settings**: Profile, org settings, integrations

## API Integration

The frontend calls the Rails backend at `/api/v1/*` endpoints. Key integrations:

- **Auth**: `/api/v1/auth/login`, `/api/v1/auth/signup`
- **Xero**: `/api/v1/xero/*` for accounting sync
- **Microsoft**: OAuth for OneDrive and calendar

## Development Notes

- Uses mock data fallbacks when API unavailable
- Dev auth bypass available for UI testing
- Turbopack enabled for fast refresh

## Migration from Old Frontend

This replaces the Vite + React Router frontend in `/frontend`. The API contract remains the same - just point to the Rails backend.
