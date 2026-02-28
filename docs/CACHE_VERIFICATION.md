# Cache Verification Guide

## Verifying Cache Functionality

### Using cURL to Test Cache Headers

After deploying the edge function with proper environment variables, verify cache behavior:

1. **First request (expect MISS):**
```bash
curl -i 'https://<project>.supabase.co/functions/v1/congress-api-v2/bill/119?format=json&limit=20&offset=0&sort=updateDate+desc'
```

Look for headers:
- `X-Cache-Status: MISS` - Initial fetch from upstream
- `X-Cache-Key: <hash>` - Note this value for debugging
- `X-Cache-TTL: 6h` - TTL for current congress bills

2. **Second request (expect HIT):**
```bash
# Same exact URL
curl -i 'https://<project>.supabase.co/functions/v1/congress-api-v2/bill/119?format=json&limit=20&offset=0&sort=updateDate+desc'
```

Should now show:
- `X-Cache-Status: HIT` - Data served from cache
- Same `X-Cache-Key` value

### In-App Verification

When toggling between congress 118 and 119 in the frontend:
- Console should show "📦 Cache hit" on repeated navigations
- Network tab should show `X-Cache-Status: HIT` header
- Response times should be significantly faster (< 100ms vs 500ms+)

### Database Verification

Query the cache table to see stored entries:
```sql
SELECT
  cache_key,
  api_name,
  endpoint,
  size_bytes,
  expires_at,
  last_accessed
FROM api_cache
WHERE api_name = 'congress'
ORDER BY last_accessed DESC
LIMIT 10;
```

### Troubleshooting

If always seeing MISS:
1. Check edge function logs for "Missing Supabase environment variables"
2. Verify secrets are set: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Check database permissions on `api_cache` table
4. Verify migration 007 has been applied successfully