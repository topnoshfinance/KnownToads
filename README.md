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
- A Farcaster account and API key (optional for full functionality)

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

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

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

The "Buy 1 USDC" button triggers a Farcaster Frame transaction:
1. User clicks button on Toad Card
2. API generates transaction calldata for Uniswap V3 swap
3. Farcaster wallet prompts user to approve
4. Transaction executes on Base
5. User receives creator coin tokens

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
