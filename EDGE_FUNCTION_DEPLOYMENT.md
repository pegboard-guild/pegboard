# Edge Function Deployment Guide

## Option 1: Deploy via Supabase Dashboard (Recommended if CLI linking fails)

### Step 1: Go to Edge Functions in Dashboard
1. Visit: https://supabase.com/dashboard/project/yurdvlcxednoaikrljbh/functions
2. Click "New Function"

### Step 2: Create the Function
1. Name: `google-civic-api`
2. Copy the contents from: `/Users/officeimac/pegboard/supabase/functions/google-civic-api/index.ts`
3. Paste into the editor

### Step 3: Set Environment Variable
1. Go to Function Settings
2. Add Secret:
   - Name: `GOOGLE_CIVIC_API_KEY`
   - Value: `AIzaSyBdQuaXgkihNPKyApEOL04gKwZgyLseMjY`

### Step 4: Deploy
Click "Deploy" button

---

## Option 2: Alternative - Use Direct API with CORS Proxy

If Edge Function deployment is blocked, we can use a CORS proxy service temporarily:

```javascript
// In googleCivic.ts, update the direct API call to use a CORS proxy:
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const url = `${CORS_PROXY}${GOOGLE_CIVIC_BASE_URL}/representatives`;
```

---

## Option 3: Reset Database Password and Use CLI

If you want to use the CLI (best for long-term):

1. Go to: https://supabase.com/dashboard/project/yurdvlcxednoaikrljbh/settings/database
2. Click "Reset Database Password"
3. Copy the new password
4. Run: `supabase link --project-ref yurdvlcxednoaikrljbh`
5. Enter the new password when prompted
6. Then run the deployment script

---

## Testing After Deployment

Once deployed (via any method), test by:

1. Opening http://localhost:3000
2. Entering zipcode 75205
3. Check browser console for:
   - "Fetching from Supabase Edge Function: 75205"
   - "Google Civic data received: {federal: X, state: Y, local: Z}"

The app should display:
- **Federal Representatives** - Active with voting data
- **State Officials** - Coming Soon
- **Local Officials** - Coming Soon

## Edge Function URL

Once deployed, your Edge Function will be available at:
```
https://yurdvlcxednoaikrljbh.supabase.co/functions/v1/google-civic-api
```

You can test it directly with:
```bash
curl -X POST https://yurdvlcxednoaikrljbh.supabase.co/functions/v1/google-civic-api \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"zipcode": "75205"}'
```