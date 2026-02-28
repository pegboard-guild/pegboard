# Deploy Congress.gov API to Supabase Edge Functions

## Why Deploy to Supabase?
- The local proxy (port 3001) is just a workaround
- Supabase Edge Functions run in the cloud, always available
- No need to run a separate server
- Properly handles CORS
- Scales automatically

## Step 1: Get Your Supabase Access Token

1. Go to https://app.supabase.com/account/tokens
2. Generate a new access token
3. Copy it (you'll need it for login)

## Step 2: Login to Supabase CLI

```bash
supabase login --token YOUR_ACCESS_TOKEN
```

Or set it as environment variable:
```bash
export SUPABASE_ACCESS_TOKEN=your-token-here
supabase login
```

## Step 3: Link Your Project

1. Go to your Supabase project dashboard
2. Copy your project reference ID from the URL:
   `https://app.supabase.com/project/[THIS_IS_YOUR_PROJECT_REF]`

3. Link the project:
```bash
cd /Users/officeimac/pegboard
supabase link --project-ref your-project-ref
```

## Step 4: Deploy the Edge Function

```bash
supabase functions deploy congress-api
```

## Step 5: Get Your Supabase URL and Anon Key

1. Go to your Supabase project settings
2. Click on "API" in the sidebar
3. Copy:
   - Project URL (like `https://xxxxx.supabase.co`)
   - Anon/Public key

## Step 6: Create .env File

Create `/Users/officeimac/pegboard/frontend/.env`:

```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

## Step 7: Update Frontend to Use Supabase

Once deployed, update `frontend/src/services/realCongressAPI.ts`:

```typescript
// Change from:
const PROXY_URL = 'http://localhost:3001';

// To:
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// And update the fetch calls to use Supabase Edge Function
```

## Step 8: Test It

```bash
curl -L -X POST 'https://your-project.supabase.co/functions/v1/congress-api' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  --data '{"endpoint":"members-by-state","state":"TX","district":"32"}'
```

## Benefits Over Local Proxy:
✅ No need to run `node proxy-server.js`  
✅ Works from any computer  
✅ Scales automatically  
✅ Always available  
✅ Proper production setup  

## Current Status:
- ✅ Edge Function code is ready in `/supabase/functions/congress-api/`
- ✅ Local proxy works as temporary solution
- ⏳ Waiting for deployment to Supabase