# 🐸 KnownToads

**Open address book for the toadgang crypto community**

A Farcaster mini app that serves as a community directory where toadgang members can showcase their profiles, social links, and creator coins.

## Features

- 🔐 **Farcaster Authentication** - Sign in with Farcaster
- 👥 **Community Gating** - Must follow @toadgod1017 to join
- 📇 **Profile Directory** - Browse all toadgang members
- 🎨 **Rich Profiles** - Display PFP, social links, and creator coins
- 💰 **Native Swaps** - Buy creator coins with Farcaster Frames
- 🔗 **Base Integration** - Built on Base (chain ID 8453)
- ⚡ **PFP Caching** - 24-hour cache for optimal performance

## Tech Stack

- **Framework**: Next.js 14 with App Router + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Farcaster Auth Kit
- **Blockchain**: Base + viem + wagmi
- **Hosting**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- A Farcaster account
- (Optional) A Farcaster API key for follower verification

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/topnoshfinance/KnownToads.git
   cd KnownToads
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   
   Create a new Supabase project and run the SQL schema:
   ```bash
   # Copy the SQL from supabase-schema.sql and run it in your Supabase SQL editor
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your values:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `FARCASTER_API_KEY` - Your Farcaster API key (from Warpcast)
   - `TOADGOD_FID` - The FID of @toadgod1017
   - `BASE_RPC_URL` - Base RPC endpoint (default: https://mainnet.base.org)
   - `ZEROX_API_KEY` - 0x API key (optional, for higher rate limits)
   - `ZORA_API_KEY` - Zora API key for creator coin swaps (get from https://zora.co/developers)
   - `NEXT_PUBLIC_UNISWAP_V4_POOL_MANAGER` - (Optional) Uniswap V4 PoolManager address on Base for direct V4 swaps

5. **Add required images**
   
   Add the following images to the `public/` directory:
   - `logo.png` - App icon (512x512px recommended)
   - `splash.png` - Splash screen (1080x1920px recommended)
   - `og-image.png` - Social sharing image (1200x630px recommended)

6. **Update manifest URLs**
   
   Edit `public/.well-known/farcaster.json` and replace `knowntoads.vercel.app` with your actual domain.

7. **Run the development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Testing as a Farcaster Mini App

To test your app as a Farcaster mini app:

1. Deploy to a public URL (e.g., Vercel)
2. Ensure the manifest is accessible at `https://yourdomain.com/.well-known/farcaster.json`
3. Open the URL in a Farcaster client (Warpcast mobile app)
4. The app will load with Frame SDK context available

## Project Structure

```
/app
  /api
    /auth/farcaster    # Farcaster authentication
    /swap/[address]    # Swap transaction endpoint
    /validate/contract # ERC-20 contract validation
  /toad/[fid]         # Individual profile view
  /profile/edit       # Profile creation/edit
  page.tsx            # Directory/landing page
/components
  /directory          # ToadGrid, ToadCard, SearchBar
  /profile            # ProfileForm, SocialLinks
  /ui                 # Button, Input, WarningIcon
/lib
  farcaster.ts        # Farcaster API client
  supabase.ts         # Supabase client
  validation.ts       # Contract & link validation
  cache.ts            # PFP caching logic
  0x-helpers.ts       # 0x Protocol API integration with multi-layer routing
  zora-swap-helpers.ts # Zora API integration
  zora-pool-helpers.ts # Zora pool metadata discovery and caching
  uniswap-v4-helpers.ts # Direct Uniswap V4 PoolManager integration
  token-helpers.ts    # Token information fetching
  swap-constants.ts   # Swap-related constants
/types
  profile.ts          # TypeScript types
```

## Database Schema

The app uses a single `profiles` table with the following structure:

- `fid` (bigint, primary key) - Farcaster ID
- `username` (text) - Farcaster username
- `pfp_url` (text) - Profile picture URL
- `pfp_cached_at` (timestamp) - PFP cache timestamp
- `creator_coin_address` (text) - ERC-20 token address on Base
- `chain_id` (int) - Blockchain chain ID (default: 8453)
- `x_handle` (text, optional) - X/Twitter handle
- `telegram_handle` (text, optional) - Telegram handle
- `zora_page_url` (text, optional) - Zora page URL
- `*_valid` (boolean) - Link health status flags
- `created_at`, `updated_at` (timestamps)

See `supabase-schema.sql` for the complete schema with indexes and RLS policies.

## Key Features Explained

### Farcaster Mini App Integration

This app is built as a proper Farcaster mini app following the official specifications:

- **Frame SDK**: Uses `@farcaster/frame-sdk` for proper mini app initialization
- **Manifest File**: Provides app metadata at `/.well-known/farcaster.json`
- **Wagmi Integration**: Uses `@farcaster/frame-wagmi-connector` for wallet connections
- **Context Access**: Retrieves user FID, username, and PFP from Frame SDK context
- **Ready Signal**: Calls `sdk.actions.ready()` to signal app is loaded
- **Back Navigation**: Enables web navigation with `sdk.back.enableWebNavigation()`

### Farcaster Authentication

Users authenticate using their Farcaster account. The app verifies they follow @toadgod1017 before allowing profile creation.

### Profile Management

Each user can create one profile (keyed by FID). Profiles include:
- Auto-populated data from Farcaster (username, PFP)
- Creator coin contract address (validated as ERC-20 on Base)
- Optional social links (X, Telegram, Zora)

### PFP Caching

Profile pictures are cached for 24 hours to reduce API calls:
- Fetched from Farcaster API on first load
- Stored in database with timestamp
- Refreshed automatically when stale

### ERC-20 Validation

When users add a creator coin address, the app:
1. Validates it's a proper Ethereum address
2. Calls Base RPC to verify contract exists
3. Checks for ERC-20 functions (totalSupply, decimals, symbol)
4. Stores chain ID for multi-chain safety

### Social Link Normalization

**Telegram handles** are automatically normalized:
- Input: `@username`, `username`, or `https://t.me/username`
- Stored: `username` (clean)
- Displayed: `@username` with link to `https://t.me/username`

### Farcaster Native Swap

The swap functionality provides seamless token swaps with **multi-layer smart routing**:

1. User enters amount and clicks swap button
2. App fetches real token symbol and decimals from the contract
3. **Multi-layer routing attempts execution** (see below)
4. Swap quote displays which provider is being used
5. User approves USDC (if needed) and executes swap
6. Transaction executes on Base with optimal routing
7. User receives creator coin tokens

#### Multi-Layer Routing Architecture

The swap system uses an intelligent 4-layer routing strategy to maximize success rates:

**Layer 1: Pool Discovery**
- Queries Zora SDK/API for Uniswap V4 pool metadata
- Extracts pool key, liquidity depth, and custom hook information
- Caches pool metadata for 24 hours to reduce API calls

**Layer 2: Enhanced Routing (if pool metadata found)**
- **2a. 0x Protocol with Pool Hints** - Tries 0x API with pool-specific routing hints (3-20% progressive slippage)
- **2b. Direct Uniswap V4** - If 0x fails, constructs direct V4 PoolManager swap transaction (10-15% slippage)
- **2c. Zora API Fallback** - Last resort with 20% slippage

**Layer 3: Standard Routing (no pool metadata)**
- **3a. 0x Protocol** - Standard 0x aggregation without hints
- **3b. Zora API Fallback** - Final fallback

**Provider Details:**
- **0x Protocol** - Primary aggregator, best for standard DEX liquidity
- **Uniswap V4 (Direct)** - Direct PoolManager calls for Zora creator coins with custom hooks
- **Zora API** - Ultimate fallback, specialized for Zora creator coins

**Benefits:**
- Higher success rate for Zora creator coins with custom V4 pools
- Lower average slippage when pool metadata is available
- Graceful degradation if primary providers fail
- Detailed console logging for routing decisions

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The app is optimized for Vercel with:
- Automatic builds
- Environment variable support
- Edge function compatibility

## Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Toadgang Lore

The toadgang is a vibrant crypto community centered around toad culture and creator economies. Led by @toadgod1017 on Farcaster, the gang embraces:
- 🐸 Toad-themed positivity and memes
- 💚 Supporting creator coins and community tokens
- 🤝 Building open, permissionless tools
- 🚀 Experimenting with crypto primitives

KnownToads is the gang's home base - where toads can connect, share their coins, and grow the ecosystem.

## License

MIT License - see LICENSE file for details

## Support

- Join the conversation on Farcaster: [@toadgod1017](https://warpcast.com/toadgod1017)
- Report issues: [GitHub Issues](https://github.com/topnoshfinance/KnownToads/issues)

---

Built with 💚 for the toadgang 🐸
