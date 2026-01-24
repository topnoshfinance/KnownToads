## Additional Fix Needed: Improve Token Symbol Fetch Reliability

After further discussion with the repo owner, we identified that the `$TOKEN` display issue is NOT a database problem - it's caused by the **sporadic/unreliable blockchain RPC calls** in `fetchTokenSymbol()`. 

The token ticker is fetched dynamically from the blockchain every time via `lib/token-helpers.ts`. The sporadic behavior (sometimes works, sometimes shows "$TOKEN") suggests:

1. RPC calls to Base blockchain sometimes fail (timeouts, rate limiting)
2. The async fetch completes AFTER the component renders, so it briefly shows "TOKEN" then may or may not update
3. Component might unmount before the fetch completes

### Requested Changes

Please update `lib/token-helpers.ts` and `components/profile/SocialLinks.tsx` to:

1. **Add retry logic** to `fetchTokenSymbol()` - try up to 3 times with exponential backoff
2. **Add a loading state** in `SocialLinks.tsx` - show a spinner or "..." instead of "$TOKEN" while fetching
3. **Add better error handling** - if all retries fail, maybe show a tooltip explaining the symbol couldn't be loaded
4. **Consider caching** - use the existing `tokenMetadataCache` in `token-helpers.ts` to cache successful fetches so subsequent renders don't need to refetch

Example retry logic:
```typescript
async function fetchTokenSymbolWithRetry(address: Address, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const symbol = await fetchTokenSymbol(address);
      if (symbol) return symbol;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // exponential backoff
      }
    }
  }
  return null;
}
```

This is a higher priority fix than the token_ticker database persistence, since the app already fetches dynamically.