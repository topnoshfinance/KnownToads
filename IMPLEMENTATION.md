# KnownToads Implementation Summary

## Overview
Complete Farcaster mini app implementation for the toadgang community directory.

## Architecture

### Frontend (Next.js 14)
- **App Router**: Server and client components
- **TypeScript**: Full type safety
- **Responsive Design**: Mobile-first approach

### Authentication & Context
- **Frame SDK**: `@farcaster/frame-sdk` for mini app integration
- **Wagmi**: `@farcaster/frame-wagmi-connector` for wallet connections
- **Context Hook**: `useFarcasterContext()` to access user FID, username, PFP

### Database (Supabase)
- **profiles table**: Stores user profiles with social links and creator coins
- **RLS policies**: Row-level security for data protection
- **Automatic timestamps**: `created_at` and `updated_at` triggers

### Blockchain (Base)
- **Contract Validation**: Verifies ERC-20 tokens on Base using viem
- **Swap Integration**: 0x Protocol swap aggregator for token swaps
- **Chain ID**: 8453 (Base)

## Key Features Implemented

### 1. Farcaster Mini App Manifest
- Located at `public/.well-known/farcaster.json`
- Defines app metadata, splash screen, required chains
- Specifies required capabilities (signIn, wallet, swapToken)

### 2. Profile Management
- **Create/Edit Profile**: Users can add their creator coin address and social links
- **Validation**: 
  - ERC-20 contract validation on Base
  - X handle format validation
  - Telegram handle normalization (strips @, https://t.me/)
  - Zora URL validation
- **PFP Caching**: 24-hour cache to reduce API calls

### 3. Directory View
- Grid layout of all toadgang members
- Search by username
- Sort by newest or alphabetical
- Click through to individual profiles

### 4. Toad Card View
- Large profile display with PFP
- Social links with validity indicators
- Creator coin address (copyable)
- "Buy 1 USDC" swap button

### 5. Swap Integration - Multi-Layer Routing

The swap system implements an intelligent 4-layer routing strategy to maximize success rates for Zora creator coins:

#### Layer 1: Pool Discovery
- Queries Zora SDK/API for Uniswap V4 pool metadata
- Extracts pool key components (currency0, currency1, fee, tickSpacing, hooks)
- Identifies custom hook contracts and liquidity depth
- Caches pool metadata for 24 hours to minimize API calls
- Falls back to inference if direct API unavailable

#### Layer 2: Enhanced Routing (when pool metadata found)
- **2a. 0x Protocol with Pool Hints**
  - Passes pool metadata as routing hints to 0x API
  - Progressive slippage: 3% → 5% → 10% → 15% → 20%
  - Best for standard liquidity with pool awareness
- **2b. Direct Uniswap V4 PoolManager**
  - Constructs direct swap through V4 PoolManager contract
  - Uses pool keys from discovery to build transaction calldata
  - Handles custom hook data and parameters
  - Uses 10-15% slippage for shallow liquidity pools
- **2c. Zora API Fallback**
  - Ultimate fallback with 20% slippage
  - Specialized for Zora creator coin swaps

#### Layer 3: Standard Routing (no pool metadata)
- **3a. 0x Protocol without hints** - Standard aggregation
- **3b. Zora API Fallback** - Final attempt

#### Implementation Files
- `lib/zora-pool-helpers.ts` - Pool metadata discovery and caching
- `lib/uniswap-v4-helpers.ts` - Direct V4 PoolManager integration
- `lib/0x-helpers.ts` - Enhanced routing logic with pool hints
- `lib/zora-swap-helpers.ts` - Zora API integration
- `components/ui/SwapModal.tsx` - UI with provider display
- API endpoint generates transaction calldata with smart routing

## Files Structure

```
/app
  /api
    /auth/farcaster       # Farcaster auth verification
    /swap/[address]       # Swap transaction endpoint
    /validate/contract    # ERC-20 validation
  /toad/[fid]            # Individual profile page
  /profile/edit          # Profile creation/edit
  page.tsx               # Directory landing page
  layout.tsx             # Root layout with providers
  globals.css            # Global styles

/components
  /directory
    ToadCard.tsx         # Profile card in grid
    ToadGrid.tsx         # Grid of profile cards
    SearchBar.tsx        # Search input
  /profile
    ProfileForm.tsx      # Profile edit form
    SocialLinks.tsx      # Social links display
  /ui
    Button.tsx           # Reusable button
    Input.tsx            # Reusable input
    WarningIcon.tsx      # Warning indicator
  FrameSDKProvider.tsx   # Frame SDK initialization

/lib
  farcaster.ts           # Farcaster API client
  supabase.ts            # Supabase client
  validation.ts          # Contract & link validation
  cache.ts               # PFP caching logic
  wagmi.tsx              # Wagmi configuration
  useFarcasterContext.ts # Hook to access Frame context
  0x-helpers.ts          # 0x Protocol API integration with multi-layer routing
  zora-swap-helpers.ts   # Zora API integration
  zora-pool-helpers.ts   # Zora pool metadata discovery and caching
  uniswap-v4-helpers.ts  # Direct Uniswap V4 PoolManager integration
  token-helpers.ts       # Token information fetching
  swap-constants.ts      # Swap-related constants

/types
  profile.ts             # TypeScript interfaces

/public
  /.well-known
    farcaster.json       # Mini app manifest
  README.md              # Public assets guide
```

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key
NEYNAR_API_KEY=                   # Neynar API key for Farcaster integration
TOADGOD_FID=482739                # FID of @toadgod1017
BASE_RPC_URL=                     # Base RPC URL (default: https://mainnet.base.org)
NEXT_PUBLIC_BASE_CHAIN_ID=        # Chain ID (default: 8453)
NEXT_PUBLIC_APP_URL=              # App URL for production
ZEROX_API_KEY=                    # 0x API key (optional, for higher rate limits)
ZORA_API_KEY=                     # Zora API key for pool discovery and swaps
NEXT_PUBLIC_UNISWAP_V4_POOL_MANAGER= # Uniswap V4 PoolManager on Base (optional, for direct V4 swaps)
NEXT_PUBLIC_UNISWAP_V4_QUOTER=    # Uniswap V4 Quoter (optional, not yet implemented)
```

## Deployment Checklist

- [ ] Set up Supabase project and run schema
- [ ] Configure environment variables in Vercel
- [ ] Add toad-themed images (logo.png, splash.png, og-image.png)
- [ ] Update manifest URLs to production domain
- [ ] Deploy to Vercel
- [ ] Test in Warpcast mobile app
- [ ] Verify follower verification works
- [ ] Test profile creation and editing
- [ ] Test swap button functionality

## Best Practices Followed

### Farcaster Mini App
- ✅ Frame SDK initialization with `sdk.actions.ready()`
- ✅ Back button support with `sdk.back.enableWebNavigation()`
- ✅ Context access via `sdk.context` for user data
- ✅ Manifest file at `/.well-known/farcaster.json`
- ✅ Wagmi connector for wallet interactions
- ✅ Required chains and capabilities specified

### Code Quality
- ✅ TypeScript for type safety
- ✅ Client/Server components properly separated
- ✅ Reusable UI components
- ✅ Error handling throughout
- ✅ Validation at multiple layers

### Performance
- ✅ PFP caching to reduce API calls
- ✅ Static generation where possible
- ✅ Optimized images (Next.js Image component)
- ✅ Efficient database queries

## Next Steps (Post-MVP)

1. **Follower Verification**: Implement actual @toadgod1017 follower check
2. **Link Health Checking**: Background job to verify social links
3. **Notification System**: Notify users of profile views/interactions
4. **Analytics**: Track app usage and popular profiles
5. **Enhanced Swap**: Calculate slippage, show preview
6. **Profile Discovery**: Featured profiles, recommendations
7. **Mobile Optimization**: Further mobile UX improvements

## Testing Notes

The app builds successfully and is ready for deployment. To fully test:

1. Deploy to a public URL
2. Configure Supabase with real credentials
3. Add the FID of @toadgod1017 to environment
4. Test in Warpcast mobile app for full Frame SDK functionality
5. Create test profiles with real Base ERC-20 tokens

## Credits

Built for the toadgang community 🐸
Using Farcaster mini apps specification from farcasterxyz/miniapps
