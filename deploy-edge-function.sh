#!/bin/bash

# Deploy Google Civic Edge Function to Supabase
# Run this script after getting your database password

echo "Deploying Google Civic Edge Function to Supabase..."
echo "Project: yurdvlcxednoaikrljbh"
echo ""

# Step 1: Link the project (you'll need to enter your database password)
echo "Step 1: Linking Supabase project..."
echo "You'll be prompted for your database password"
supabase link --project-ref yurdvlcxednoaikrljbh

# Step 2: Set the Google Civic API key as a secret
echo ""
echo "Step 2: Setting Google Civic API key as secret..."
supabase secrets set GOOGLE_CIVIC_API_KEY=AIzaSyBdQuaXgkihNPKyApEOL04gKwZgyLseMjY

# Step 3: Deploy the Edge Function
echo ""
echo "Step 3: Deploying google-civic-api Edge Function..."
supabase functions deploy google-civic-api

echo ""
echo "✅ Deployment complete!"
echo ""
echo "The Edge Function is now available at:"
echo "https://yurdvlcxednoaikrljbh.supabase.co/functions/v1/google-civic-api"
echo ""
echo "Next steps:"
echo "1. Test the function by visiting http://localhost:3000"
echo "2. Enter zipcode 75205"
echo "3. Check for multi-level representatives display"