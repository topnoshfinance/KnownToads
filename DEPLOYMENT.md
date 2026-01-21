# Deployment Guide for KnownToads

This guide walks you through deploying the KnownToads Farcaster mini app to production.

## Prerequisites

- A Vercel account (free tier is fine)
- A Supabase account and project
- Domain access (or use Vercel's provided domain)
- Toad-themed images ready

## Step 1: Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor
3. Copy the contents of `supabase-schema.sql`
4. Run the SQL script to create tables, indexes, and RLS policies
5. Note your Supabase URL and keys from Settings > API

## Step 2: Prepare Images

Create and add these images to the `public/` directory:

- `logo.png` - 512x512px square logo with toad theme
- `splash.png` - 1080x1920px splash screen (portrait)
- `og-image.png` - 1200x630px social sharing image

Make these playful, green-themed, and toad-focused!

## Step 3: Configure for Your Domain

1. Edit `public/.well-known/farcaster.json`
2. Replace all instances of `knowntoads.vercel.app` with your actual domain
3. Update the `homeUrl`, `iconUrl`, `imageUrl`, and `splashImageUrl` fields

Example for custom domain `toads.example.com`:
```json
{
  "miniapp": {
    "homeUrl": "https://toads.example.com",
    "iconUrl": "https://toads.example.com/logo.png",
    ...
  }
}
```

## Step 4: Deploy to Vercel

### Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Via Vercel Dashboard

1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js
5. Click "Deploy"

## Step 5: Configure Environment Variables

In Vercel Dashboard:

1. Go to your project
2. Click "Settings" > "Environment Variables"
3. Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
FARCASTER_API_KEY=your_farcaster_api_key (optional)
TOADGOD_FID=12345
BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_CHAIN_ID=8453
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

4. Redeploy after adding variables

## Step 6: Get @toadgod1017's FID

1. Go to https://warpcast.com/toadgod1017
2. Look at the profile URL or use a Farcaster API
3. Update `TOADGOD_FID` environment variable with the correct FID

## Step 7: Verify Manifest Accessibility

Test that your manifest is accessible:

```bash
curl https://your-domain.vercel.app/.well-known/farcaster.json
```

You should see the JSON manifest returned.

## Step 8: Test in Warpcast

1. Open Warpcast mobile app
2. Go to your deployed URL
3. The app should load as a mini app with Frame SDK context
4. Test the "Connect Farcaster" button
5. Try creating a profile
6. Verify all features work

## Step 9: Register Your Mini App (Optional)

For better discovery, you can use Farcaster Hosted Manifests:

1. Go to https://farcaster.xyz/~/developers/mini-apps/manifest
2. Register your domain and app details
3. Get a hosted manifest ID
4. Update your app to redirect to the hosted manifest (see README for redirect setup)

## Common Issues

### Manifest not loading
- Check that `public/.well-known/farcaster.json` is deployed
- Verify the file is accessible at `https://yourdomain/.well-known/farcaster.json`
- Ensure proper JSON syntax

### Frame SDK not initializing
- App must be opened from Warpcast or a Farcaster client
- Check browser console for errors
- Verify Frame SDK is properly imported

### Supabase connection errors
- Double-check environment variables are set correctly
- Ensure RLS policies allow the operations you're trying
- Check Supabase logs for detailed errors

### Wallet not connecting
- Ensure user is in a Farcaster client environment
- Check that wagmi is properly configured
- Verify Frame connector is available

### ERC-20 validation failing
- Ensure BASE_RPC_URL is correct and accessible
- Check that the token address is actually on Base (chain ID 8453)
- Verify the contract implements ERC-20 standard

## Post-Deployment

After deployment:

1. Share your app URL in the toadgang community
2. Monitor Supabase for usage
3. Check error logs in Vercel
4. Gather user feedback
5. Iterate on features

## Updating Your App

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

Vercel will automatically redeploy on push to main branch.

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase logs
3. Review browser console errors
4. Open an issue on GitHub

---

Happy deploying! 🐸
