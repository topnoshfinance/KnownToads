# Testing Guide: 0x Primary Swap Provider with Aggressive Slippage

## What Changed

This refactor switches the swap provider priority from Zora-first to 0x-first, implementing aggressive slippage escalation to improve success rates for creator coin swaps on shallow Uniswap V4 pools.

### Key Changes

1. **Provider Priority Reversed**
   - **Before**: Zora → 0x (fallback)
   - **After**: 0x → Zora (fallback)

2. **Aggressive Slippage Escalation**
   - **Before**: [5%, 10%, 15%] via `slippagePercentage`
   - **After**: [3%, 5%, 10%, 15%, 20%] via `slippageBps` (basis points)

3. **Enhanced 0x Integration**
   - Added `includeSources: 'UniswapV4,Uniswap'` parameter to prioritize V4 pools with Zora hooks
   - Added explicit validation error checking for liquidity issues
   - Full quote response logging with validation errors and sources

4. **Zora as High-Slippage Fallback**
   - Zora now uses 20% slippage (2000 bps) when used as fallback
   - Enhanced logging with `[Zora]` prefix for easy debugging

5. **UI Improvements**
   - High slippage warning displays when slippage >= 10%
   - Shows actual slippage used (e.g., "10.0%")
   - Shows provider used ("0x Protocol" or "Zora (Fallback)")
   - Shows price impact when available

## Testing Checklist

### 1. Liquid Pairs (Established Creator Coins)
**Expected Behavior**: Fast quotes at low slippage, no warnings

- [ ] Test with a well-known Zora creator coin (e.g., high volume coin)
- [ ] Verify quote returns within 1-2 seconds
- [ ] Verify slippage is 3-5% (300-500 bps)
- [ ] Verify no high slippage warning appears
- [ ] Verify provider shows "0x Protocol"
- [ ] Execute swap and verify success

**Expected Console Logs**:
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Attempting quote with 300 bps (3.0%) slippage...
[0x] Response at 300 bps: {
  "status": 200,
  "liquidityAvailable": true,
  "buyAmount": "...",
  "sources": [...]
}
[0x] ✓ Quote successful at 300 bps (3.0%)
[SWAP] ✓ 0x quote successful, returning 0x result
```

### 2. Shallow Pairs (Newly Created Coins)
**Expected Behavior**: Slower quotes with escalating slippage, warning shown

- [ ] Test with a newly created or low-volume creator coin
- [ ] Verify quote may take 2-4 seconds (multiple retries)
- [ ] Verify slippage escalates to 10-20% (1000-2000 bps)
- [ ] Verify high slippage warning appears with orange background
- [ ] Verify provider shows "0x Protocol"
- [ ] Warning message includes actual slippage percentage
- [ ] Execute swap and verify success

**Expected Console Logs**:
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Attempting quote with 300 bps (3.0%) slippage...
[0x] API error at 300 bps: 404 ...
[0x] Attempting quote with 500 bps (5.0%) slippage...
[0x] API error at 500 bps: 404 ...
[0x] Attempting quote with 1000 bps (10.0%) slippage...
[0x] Response at 1000 bps: {
  "status": 200,
  "buyAmount": "...",
  "priceImpactPercentage": "8.5"
}
[0x] ✓ Quote successful at 1000 bps (10.0%)
[SWAP] ✓ 0x quote successful, returning 0x result
```

### 3. No Liquidity Pairs
**Expected Behavior**: Both providers fail with clear error message

- [ ] Test with a token address that has no liquidity
- [ ] Verify 0x tries all slippage tiers (3%, 5%, 10%, 15%, 20%)
- [ ] Verify Zora fallback is attempted with 20% slippage
- [ ] Verify error message: "No liquidity available for this token..."
- [ ] Verify no quote is displayed

**Expected Console Logs**:
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Attempting quote with 300 bps (3.0%) slippage...
[0x] API error at 300 bps: 404 ...
[0x] Attempting quote with 500 bps (5.0%) slippage...
[0x] API error at 500 bps: 404 ...
... (continues through all tiers)
[0x] Quote failed at all slippage levels
[SWAP] ⚠️ 0x quote failed, trying Zora fallback...
[SWAP] 🔄 Attempting Zora (fallback provider)...
[Zora] API Request: {..., slippageUsed: "2000 bps (20.0%)"}
[Zora] API error response: {status: 404, ...}
[SWAP] ❌ Zora quote also failed: ...
[SWAP] ❌ Both providers failed
```

### 4. Zora Fallback Scenario
**Expected Behavior**: 0x fails, Zora succeeds with high slippage

- [ ] Temporarily disable 0x API (remove/rename `ZEROX_API_KEY` env var)
- [ ] Test with a Zora creator coin
- [ ] Verify 0x fails at all slippage levels
- [ ] Verify Zora fallback is attempted
- [ ] Verify provider shows "Zora (Fallback)"
- [ ] Verify slippage shows "20.0%"
- [ ] Verify high slippage warning appears
- [ ] Execute swap and verify success
- [ ] Re-enable 0x API

**Expected Console Logs**:
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Attempting quote with 300 bps (3.0%) slippage...
[0x] API error at 300 bps: 401 Unauthorized
... (all tiers fail)
[0x] Quote failed at all slippage levels
[SWAP] ⚠️ 0x quote failed, trying Zora fallback...
[SWAP] 🔄 Attempting Zora (fallback provider)...
[Zora] API Request: {
  ...,
  slippageUsed: "2000 bps (20.0%)"
}
[Zora] API Response Status: 200
[Zora] API successful response: {...}
[SWAP] ✓ Zora quote successful, returning Zora result
```

## Expected Console Log Patterns

### 0x Success (Low Slippage)
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Attempting quote with 300 bps (3.0%) slippage...
[0x] Response at 300 bps: {...}
[0x] ✓ Quote successful at 300 bps (3.0%)
[SWAP] ✓ 0x quote successful, returning 0x result
```

### 0x Success (High Slippage)
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Attempting quote with 300 bps (3.0%) slippage...
[0x] API error at 300 bps: 404
[0x] Attempting quote with 500 bps (5.0%) slippage...
[0x] API error at 500 bps: 404
[0x] Attempting quote with 1000 bps (10.0%) slippage...
[0x] Response at 1000 bps: {...}
[0x] ✓ Quote successful at 1000 bps (10.0%)
[SWAP] ✓ 0x quote successful, returning 0x result
```

### Zora Fallback Success
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Quote failed at all slippage levels
[SWAP] ⚠️ 0x quote failed, trying Zora fallback...
[SWAP] 🔄 Attempting Zora (fallback provider)...
[Zora] API Request: {..., slippageUsed: "2000 bps (20.0%)"}
[Zora] API Response Status: 200
[SWAP] ✓ Zora quote successful, returning Zora result
```

### Both Providers Failed
```
[SWAP] 🔍 Attempting 0x first (primary provider)...
[0x] Quote failed at all slippage levels
[SWAP] ⚠️ 0x quote failed, trying Zora fallback...
[SWAP] 🔄 Attempting Zora (fallback provider)...
[Zora] API error response: {status: 404, ...}
[SWAP] ❌ Zora quote also failed: ...
[SWAP] ❌ Both providers failed
```

## Debugging Steps

### Quote Failures

1. **Check console logs** for provider order:
   - Should see `[SWAP] 🔍 Attempting 0x first` before Zora
   - Verify slippage escalation: 300 → 500 → 1000 → 1500 → 2000 bps

2. **Check API responses**:
   - Look for `[0x] Response at X bps:` with full quote details
   - Check `validationErrors` array for liquidity issues
   - Check `sources` array to see which DEXs were used

3. **Verify API keys**:
   - Ensure `ZEROX_API_KEY` is set for production
   - `ZORA_API_KEY` is optional but recommended

4. **Check slippage escalation**:
   - Should try 5 different slippage levels for 0x
   - Each failure should log clearly with bps value

### High Slippage Warning Not Showing

1. **Check quote result**:
   - Look for `highSlippageWarning: true` in quote object
   - Verify `slippageBps >= 1000` (10%)

2. **Check state updates**:
   - Verify `setShowSlippageWarning` is called in `fetchQuote`
   - Check React DevTools for `showSlippageWarning` state

### Provider Not Showing Correctly

1. **Check quote.provider value**:
   - Should be `'0x'` or `'zora'`
   - Verify `getProviderDisplay()` returns correct string

2. **Check console logs**:
   - Look for `[SWAP] ✓ 0x quote successful` or `[SWAP] ✓ Zora quote successful`
   - Provider is set at the end of each successful quote

## Success Criteria

After implementing and testing:

- ✅ 0x is tried first (not Zora)
- ✅ Slippage escalates through all 5 tiers: 3% → 5% → 10% → 15% → 20%
- ✅ Console logs show full quote responses with validation errors
- ✅ UI warns users when slippage >= 10%
- ✅ Zora works as fallback with 20% slippage
- ✅ Liquid pairs quote quickly (<1s) at low slippage
- ✅ Shallow pairs succeed at higher slippage with warning
- ✅ Both providers failing shows clear "No liquidity" error
- ✅ Provider name displayed correctly ("0x Protocol" or "Zora (Fallback)")
- ✅ Actual slippage percentage displayed (e.g., "10.0%")
- ✅ High slippage warning has orange styling and clear message

## Additional Notes

- **Performance**: First quote may take 2-4 seconds for shallow pairs due to slippage escalation
- **Gas Costs**: Higher slippage doesn't affect gas costs, only execution price
- **Price Impact**: Displayed separately from slippage when available from 0x
- **Fallback Behavior**: Zora always uses 20% slippage when used as fallback, regardless of quote complexity
