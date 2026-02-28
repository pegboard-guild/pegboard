# Pegboard Architecture

## Overview

Pegboard follows a modern JAMstack architecture with real-time capabilities:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  React Frontend │────▶│  Supabase Backend│────▶│ Congress.gov API│
│   (TypeScript)  │     │   (PostgreSQL)   │     │   (Real Data)   │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│  Local Storage  │     │  Edge Functions  │
│  (Session Data) │     │   (API Proxy)    │
└─────────────────┘     └──────────────────┘
```

## Frontend Architecture

### Technology Stack
- React 18 with TypeScript
- CSS3 (no framework, custom styling)
- No external UI libraries (built from scratch)

### Directory Structure
```
frontend/src/
├── components/       # Reusable UI components
├── pages/           # Page-level components
├── services/        # API and data services
├── types/           # TypeScript definitions
└── utils/           # Helper functions
```

### Key Components
- `LandingPage` - Zipcode entry and welcome
- `Dashboard` - Main app interface
- `RepresentativeCard` - Display representative info
- `ActivityCard` - Show voting activity
- `TrendingBills` - Popular legislation

### State Management
- React hooks (useState, useEffect)
- Local storage for session persistence
- Supabase real-time subscriptions

## Backend Architecture

### Database Schema
```sql
-- Core Tables
districts        # Zipcode to district mapping
members          # Congressional representatives
bills            # Legislation tracking
votes            # Voting records
pegs             # User opinions
attribution      # Alignment calculations
```

### Real-time Features
- Activity feed updates via Supabase subscriptions
- Live voting record updates
- Real-time alignment scoring

### API Integration

#### Congress.gov API
- Primary data source for congressional data
- Requires API key
- CORS restrictions (needs proxy)

#### Proxy Solutions
1. **Development**: Local Express proxy (port 3001)
2. **Production**: Supabase Edge Functions

## Data Flow

### User Journey
1. User enters zipcode
2. System determines congressional district
3. Fetches representatives for that district
4. Loads recent bills and voting activity
5. User can "peg" opinions on bills
6. System calculates alignment scores

### Real-time Updates
```
User Action → Supabase → PostgreSQL → Broadcast → All Clients
```

## Security Considerations

- API keys stored in environment variables
- Row-level security in Supabase
- Anonymous sessions (no PII collected)
- CORS handled by proxy/edge functions

## Scalability

### Current (MVP)
- Single region deployment
- Federal government focus
- ~535 members of Congress

### Future
- Multi-region deployment
- State and local government
- Millions of officials tracked
- Distributed caching layer

## Performance Optimizations

- Lazy loading of components
- Debounced API calls
- Cached alignment scores (5-minute TTL)
- Optimistic UI updates
- Real-time subscriptions for live data