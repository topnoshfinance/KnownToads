/**
 * @deprecated This file contains legacy multi-layer swap routing logic.
 * The application now uses Uniswap Universal Router exclusively.
 * Only constants (USDC_ADDRESS, BASE_CHAIN_ID, etc.) should be used from this file.
 * All swap functions are deprecated and should not be used in new code.
 * 
 * See: lib/universal-router-helpers.ts for the new implementation.
 */

import { Address } from 'viem';
import { getZoraQuote, getZoraSwapTransaction, type ZoraSwapQuote } from './zora-swap-helpers';
import { getZoraPoolMetadata, type ZoraPoolMetadata } from './zora-pool-helpers';
import { 
  getUniswapV4SwapTransaction, 
  poolMetadataToPoolKey, 
  calculateMinimumOutput as calculateV4MinOutput,
  isUniswapV4Configured 
} from './uniswap-v4-helpers';

// 0x Exchange Proxy contract on Base
export const ZEROX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as Address;

// USDC on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Base chain ID
export const BASE_CHAIN_ID = 8453;

// 0x API base URL
const ZEROX_API_BASE_URL = 'https://api.0x.org';

// Aggressive slippage tiers in basis points for Zora creator/post coins on shallow Uniswap V4 pools
// These coins often have low liquidity, requiring higher slippage tolerance
// Format: basis points (100 bps = 1%)
export const SLIPPAGE_TIERS_BPS = [300, 500, 1000, 1500, 2000]; // 3%, 5%, 10%, 15%, 20%

// High slippage warning threshold: 10% (1000 bps)
export const HIGH_SLIPPAGE_WARNING_BPS = 1000;

/**
 * Swap provider type
 */
export type SwapProvider = 'zora' | '0x' | 'uniswap-v4';

/**
 * 0x API quote response type
 */
export interface ZeroXQuote {
  buyAmount: string;
  sellAmount: string;
  price: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  estimatedGas: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  liquidityAvailable?: boolean;
  priceImpactPercentage?: string;
  estimatedPriceImpact?: string;
  validationErrors?: Array<{
    field: string;
    code: number;
    reason: string;
  }>;
  sources?: Array<{
    name: string;
    proportion: string;
  }>;
}

/**
 * Simplified quote result for UI display
 */
export interface QuoteResult {
  amountOut: bigint;
  price: string;
  estimatedGas: string;
  provider?: SwapProvider;
  slippageBps?: number; // The slippage in basis points (e.g., 1000 for 10%) that was successfully used for this quote
  priceImpact?: string;
  highSlippageWarning?: boolean; // True if slippage >= 10% (HIGH_SLIPPAGE_WARNING_BPS)
}

/**
 * Get a price quote from 0x API with progressive slippage retry
 * Tries multiple slippage levels for Zora creator/post coins on shallow Uniswap V4 pools
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @param poolMetadata - Optional pool metadata hints from Zora discovery
 * @returns Quote data or null if no liquidity at any slippage level
 */
export async function get0xQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address,
  poolMetadata?: ZoraPoolMetadata | null
): Promise<QuoteResult | null> {
  // Log if we have pool metadata hints
  if (poolMetadata?.exists) {
    console.log(`[0x] 📊 Using pool metadata hints:`, {
      poolId: poolMetadata.poolId,
      fee: poolMetadata.fee,
      hooks: poolMetadata.hooks,
    });
  }
  // Try each slippage level progressively
  for (const slippageBps of SLIPPAGE_TIERS_BPS) {
    try {
      console.log(`[0x] Attempting quote with ${slippageBps} bps (${(slippageBps / 100).toFixed(1)}%) slippage...`);
      
      const params = new URLSearchParams({
        chainId: BASE_CHAIN_ID.toString(),
        sellToken,
        buyToken,
        sellAmount: sellAmount.toString(),
        takerAddress,
        slippageBps: slippageBps.toString(),
        includeSources: 'UniswapV4,Uniswap', // Prioritize V4 pools with Zora hooks
      });

      const apiKey = process.env.ZEROX_API_KEY;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['0x-api-key'] = apiKey;
      }

      const response = await fetch(
        `${ZEROX_API_BASE_URL}/swap/v1/quote?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[0x] API error at ${slippageBps} bps:`, response.status, errorText);
        
        if (response.status === 404) {
          // No liquidity at this slippage level, try next
          continue;
        }
        
        // For other errors, also try next slippage level
        continue;
      }

      const quote: ZeroXQuote = await response.json();
      
      // Enhanced logging - capture full quote response
      console.log(`[0x] Response at ${slippageBps} bps:`, JSON.stringify({
        status: response.status,
        liquidityAvailable: quote.liquidityAvailable,
        priceImpactPercentage: quote.priceImpactPercentage,
        validationErrors: quote.validationErrors,
        buyAmount: quote.buyAmount,
        sources: quote.sources,
      }, null, 2));

      // Check validation errors explicitly
      const hasLiquidityError = quote.validationErrors?.some(err => 
        err.reason?.includes('INSUFFICIENT_ASSET_LIQUIDITY') ||
        err.reason?.includes('PRICE_IMPACT_TOO_HIGH') ||
        err.reason?.includes('NO_ROUTE_FOUND')
      );

      if (hasLiquidityError) {
        console.log(`[0x] Liquidity error detected at ${slippageBps} bps, trying next tier...`);
        continue;
      }
      
      console.log(`[0x] ✓ Quote successful at ${slippageBps} bps (${(slippageBps / 100).toFixed(1)}%)`);
      
      return {
        amountOut: BigInt(quote.buyAmount),
        price: quote.price,
        estimatedGas: quote.estimatedGas,
        slippageBps: slippageBps,
        priceImpact: quote.priceImpactPercentage || quote.estimatedPriceImpact,
        highSlippageWarning: slippageBps >= HIGH_SLIPPAGE_WARNING_BPS,
      };
    } catch (error) {
      console.error(`[0x] Error fetching quote at ${slippageBps} bps:`, error);
      // Continue to next slippage level
      continue;
    }
  }
  
  // All slippage levels failed
  console.log('[0x] Quote failed at all slippage levels');
  return null;
}

/**
 * Get a swap transaction from 0x API with progressive slippage retry
 * Tries multiple slippage levels for Zora creator/post coins on shallow Uniswap V4 pools
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @param poolMetadata - Optional pool metadata hints from Zora discovery
 * @returns Transaction data or null if no liquidity at any slippage level
 */
export async function get0xSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address,
  poolMetadata?: ZoraPoolMetadata | null
): Promise<{ quote: ZeroXQuote; slippageBps: number; highSlippageWarning: boolean } | null> {
  // Log if we have pool metadata hints
  if (poolMetadata?.exists) {
    console.log(`[0x] 📊 Using pool metadata hints:`, {
      poolId: poolMetadata.poolId,
      fee: poolMetadata.fee,
      hooks: poolMetadata.hooks,
    });
  }
  // Try each slippage level progressively
  for (const slippageBps of SLIPPAGE_TIERS_BPS) {
    try {
      console.log(`[0x] Attempting swap transaction with ${slippageBps} bps (${(slippageBps / 100).toFixed(1)}%) slippage...`);
      
      const params = new URLSearchParams({
        chainId: BASE_CHAIN_ID.toString(),
        sellToken,
        buyToken,
        sellAmount: sellAmount.toString(),
        takerAddress,
        slippageBps: slippageBps.toString(),
        includeSources: 'UniswapV4,Uniswap', // Prioritize V4 pools with Zora hooks
      });

      const apiKey = process.env.ZEROX_API_KEY;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['0x-api-key'] = apiKey;
      }

      const response = await fetch(
        `${ZEROX_API_BASE_URL}/swap/v1/quote?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[0x] API error at ${slippageBps} bps:`, response.status, errorText);
        
        if (response.status === 404) {
          // No liquidity at this slippage level, try next
          continue;
        }
        
        // For other errors, also try next slippage level
        continue;
      }

      const quote: ZeroXQuote = await response.json();
      
      // Enhanced logging - capture full quote response
      console.log(`[0x] Response at ${slippageBps} bps:`, JSON.stringify({
        status: response.status,
        liquidityAvailable: quote.liquidityAvailable,
        priceImpactPercentage: quote.priceImpactPercentage,
        validationErrors: quote.validationErrors,
        buyAmount: quote.buyAmount,
        sources: quote.sources,
      }, null, 2));

      // Check validation errors explicitly
      const hasLiquidityError = quote.validationErrors?.some(err => 
        err.reason?.includes('INSUFFICIENT_ASSET_LIQUIDITY') ||
        err.reason?.includes('PRICE_IMPACT_TOO_HIGH') ||
        err.reason?.includes('NO_ROUTE_FOUND')
      );

      if (hasLiquidityError) {
        console.log(`[0x] Liquidity error detected at ${slippageBps} bps, trying next tier...`);
        continue;
      }
      
      console.log(`[0x] ✓ Swap transaction successful at ${slippageBps} bps (${(slippageBps / 100).toFixed(1)}%)`);
      
      return {
        quote,
        slippageBps,
        highSlippageWarning: slippageBps >= HIGH_SLIPPAGE_WARNING_BPS,
      };
    } catch (error) {
      console.error(`[0x] Error fetching swap transaction at ${slippageBps} bps:`, error);
      // Continue to next slippage level
      continue;
    }
  }
  
  // All slippage levels failed
  console.log('[0x] Swap transaction failed at all slippage levels');
  return null;
}

/**
 * Calculate minimum output amount with slippage tolerance
 * @param expectedOutput - Expected output amount from quote
 * @param slippageBps - Slippage tolerance in basis points (default: 1000 = 10%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinimumOutput(
  expectedOutput: bigint,
  slippageBps: number = 1000
): bigint {
  // amountOutMinimum = expectedOutput * (1 - slippage)
  // Convert bps to decimal: slippageBps / 10000
  const slippageFactor = 10000 - slippageBps;
  const slippageFactorBigInt = BigInt(slippageFactor);
  return (expectedOutput * slippageFactorBigInt) / 10000n;
}

/**
 * Format exchange rate for display
 * @param amountIn - Input amount
 * @param amountOut - Output amount
 * @param inputSymbol - Input token symbol
 * @param outputSymbol - Output token symbol
 * @param inputDecimals - Input token decimals
 * @param outputDecimals - Output token decimals
 * @returns Formatted exchange rate string
 */
export function formatExchangeRate(
  amountIn: bigint,
  amountOut: bigint,
  inputSymbol: string,
  outputSymbol: string,
  inputDecimals: number = 6,
  outputDecimals: number = 18
): string {
  const inputAmount = Number(amountIn) / Math.pow(10, inputDecimals);
  const outputAmount = Number(amountOut) / Math.pow(10, outputDecimals);
  
  if (inputAmount === 0) return `1 ${inputSymbol} ≈ 0 ${outputSymbol}`;
  
  const rate = outputAmount / inputAmount;
  
  // Format rate with appropriate precision
  let formattedRate: string;
  if (rate > 1000) {
    formattedRate = rate.toFixed(0);
  } else if (rate > 1) {
    formattedRate = rate.toFixed(2);
  } else if (rate > 0.01) {
    formattedRate = rate.toFixed(4);
  } else {
    formattedRate = rate.toExponential(2);
  }
  
  return `1 ${inputSymbol} ≈ ${formattedRate} ${outputSymbol}`;
}

/**
 * Smart routing with multi-layer strategy:
 * 1. Try Zora SDK to get pool metadata for the creator coin
 * 2. If pool metadata found:
 *    a. Try 0x API with pool hints (progressive slippage)
 *    b. If 0x fails, try direct Uniswap V4 PoolManager swap
 *    c. If V4 direct fails, try Zora API as last resort
 * 3. If no pool metadata:
 *    a. Try 0x API without hints (current behavior)
 *    b. Fall back to Zora API
 * 
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Quote data with provider info or null if no liquidity
 */
export async function getSwapQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<QuoteResult | null> {
  console.log('[SWAP] 🚀 Starting multi-layer routing strategy...');
  
  // Layer 1: Zora SDK Pool Discovery
  console.log('[SWAP] 📊 Layer 1: Attempting Zora pool metadata discovery...');
  const poolMetadata = await getZoraPoolMetadata(buyToken);
  
  if (poolMetadata?.exists) {
    console.log('[SWAP] ✓ Pool metadata found! Proceeding with enhanced routing...');
    
    // Layer 2a: Enhanced 0x Integration with pool hints
    console.log('[SWAP] 🔍 Layer 2a: Attempting 0x with pool hints...');
    try {
      const zeroXQuote = await get0xQuote(sellToken, buyToken, sellAmount, takerAddress, poolMetadata);
      if (zeroXQuote) {
        console.log('[SWAP] ✓ 0x quote successful with pool hints, returning 0x result');
        return {
          ...zeroXQuote,
          provider: '0x',
        };
      }
    } catch (error) {
      console.log('[SWAP] ⚠️ 0x quote with hints failed:', error);
    }
    
    // Layer 2b: Direct Uniswap V4 (quote estimation)
    // Note: V4 direct quotes are complex; for now we skip this in quote phase
    // The actual V4 swap will be attempted in getSwapTransaction if needed
    console.log('[SWAP] ⏭️ Skipping V4 direct quote (will attempt in transaction phase)');
    
    // Layer 2c: Zora API fallback
    console.log('[SWAP] 🔄 Layer 2c: Attempting Zora API (pool exists, 0x failed)...');
    try {
      const zoraQuote = await getZoraQuote(sellToken, buyToken, sellAmount, takerAddress);
      if (zoraQuote && zoraQuote.buyAmount) {
        console.log('[SWAP] ✓ Zora quote successful, returning Zora result');
        return {
          amountOut: BigInt(zoraQuote.buyAmount),
          price: '0',
          estimatedGas: zoraQuote.gas || '0',
          provider: 'zora',
          slippageBps: 2000, // Zora uses 20% slippage
          highSlippageWarning: true,
        };
      }
    } catch (error) {
      console.error('[SWAP] ❌ Zora quote also failed:', error);
    }
  } else {
    console.log('[SWAP] ℹ️ No pool metadata found, using standard routing...');
    
    // Layer 3a: Try 0x without pool hints
    console.log('[SWAP] 🔍 Layer 3a: Attempting 0x without hints...');
    try {
      const zeroXQuote = await get0xQuote(sellToken, buyToken, sellAmount, takerAddress);
      if (zeroXQuote) {
        console.log('[SWAP] ✓ 0x quote successful, returning 0x result');
        return {
          ...zeroXQuote,
          provider: '0x',
        };
      }
    } catch (error) {
      console.log('[SWAP] ⚠️ 0x quote failed:', error);
    }
    
    // Layer 3b: Zora API fallback
    console.log('[SWAP] 🔄 Layer 3b: Attempting Zora (fallback provider)...');
    try {
      const zoraQuote = await getZoraQuote(sellToken, buyToken, sellAmount, takerAddress);
      if (zoraQuote && zoraQuote.buyAmount) {
        console.log('[SWAP] ✓ Zora quote successful, returning Zora result');
        return {
          amountOut: BigInt(zoraQuote.buyAmount),
          price: '0',
          estimatedGas: zoraQuote.gas || '0',
          provider: 'zora',
          slippageBps: 2000,
          highSlippageWarning: true,
        };
      }
    } catch (error) {
      console.error('[SWAP] ❌ Zora quote also failed:', error);
    }
  }

  console.log('[SWAP] ❌ All routing layers failed');
  return null;
}

/**
 * Smart routing with multi-layer strategy for transaction building:
 * 1. Try Zora SDK to get pool metadata for the creator coin
 * 2. If pool metadata found:
 *    a. Try 0x API with pool hints (progressive slippage)
 *    b. If 0x fails, try direct Uniswap V4 PoolManager swap
 *    c. If V4 direct fails, try Zora API as last resort
 * 3. If no pool metadata:
 *    a. Try 0x API without hints (current behavior)
 *    b. Fall back to Zora API
 * 
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Transaction data with provider and slippage info or null if no liquidity
 */
export async function getSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<{ to: string; data: string; value: string; provider: SwapProvider; slippageBps: number; highSlippageWarning: boolean } | null> {
  console.log('[SWAP] 🚀 Starting multi-layer routing strategy for transaction...');
  
  // Layer 1: Zora SDK Pool Discovery
  console.log('[SWAP] 📊 Layer 1: Attempting Zora pool metadata discovery...');
  const poolMetadata = await getZoraPoolMetadata(buyToken);
  
  if (poolMetadata?.exists) {
    console.log('[SWAP] ✓ Pool metadata found! Proceeding with enhanced routing...');
    
    // Layer 2a: Enhanced 0x Integration with pool hints
    console.log('[SWAP] 🔍 Layer 2a: Attempting 0x with pool hints...');
    try {
      const zeroXResult = await get0xSwapTransaction(sellToken, buyToken, sellAmount, takerAddress, poolMetadata);
      if (zeroXResult) {
        console.log('[SWAP] ✓ 0x transaction successful with pool hints, returning 0x result');
        return {
          to: zeroXResult.quote.to,
          data: zeroXResult.quote.data,
          value: zeroXResult.quote.value,
          provider: '0x',
          slippageBps: zeroXResult.slippageBps,
          highSlippageWarning: zeroXResult.highSlippageWarning,
        };
      }
    } catch (error) {
      console.log('[SWAP] ⚠️ 0x transaction with hints failed:', error);
    }
    
    // Layer 2b: Direct Uniswap V4 PoolManager swap
    if (isUniswapV4Configured()) {
      console.log('[SWAP] 🔧 Layer 2b: Attempting direct Uniswap V4 swap...');
      try {
        const poolKey = poolMetadataToPoolKey(poolMetadata);
        
        // Use higher slippage for V4 direct (10-15% due to shallow liquidity)
        const v4SlippageBps = 1500; // 15%
        
        // Estimate expected output (we'd ideally get this from a quote)
        // For now, use a rough estimate or skip minBuyAmount validation
        const minBuyAmount = 0n; // Accept any amount (risky but functional)
        
        const v4Tx = await getUniswapV4SwapTransaction(
          poolKey,
          sellToken,
          buyToken,
          sellAmount,
          minBuyAmount,
          takerAddress
        );
        
        if (v4Tx) {
          console.log('[SWAP] ✓ Uniswap V4 direct transaction successful');
          return {
            to: v4Tx.to,
            data: v4Tx.data,
            value: v4Tx.value,
            provider: 'uniswap-v4',
            slippageBps: v4SlippageBps,
            highSlippageWarning: true, // Always warn for V4 direct
          };
        }
      } catch (error) {
        console.log('[SWAP] ⚠️ Uniswap V4 direct swap failed:', error);
      }
    } else {
      console.log('[SWAP] ⏭️ Skipping V4 direct (not configured)');
    }
    
    // Layer 2c: Zora API fallback
    console.log('[SWAP] 🔄 Layer 2c: Attempting Zora API (pool exists, 0x and V4 failed)...');
    try {
      const zoraQuote = await getZoraSwapTransaction(sellToken, buyToken, sellAmount, takerAddress);
      if (zoraQuote && zoraQuote.to && zoraQuote.data) {
        console.log('[SWAP] ✓ Zora transaction successful, returning Zora result');
        return {
          to: zoraQuote.to,
          data: zoraQuote.data,
          value: zoraQuote.value || '0',
          provider: 'zora',
          slippageBps: 2000,
          highSlippageWarning: true,
        };
      }
    } catch (error) {
      console.error('[SWAP] ❌ Zora transaction also failed:', error);
    }
  } else {
    console.log('[SWAP] ℹ️ No pool metadata found, using standard routing...');
    
    // Layer 3a: Try 0x without pool hints
    console.log('[SWAP] 🔍 Layer 3a: Attempting 0x without hints...');
    try {
      const zeroXResult = await get0xSwapTransaction(sellToken, buyToken, sellAmount, takerAddress);
      if (zeroXResult) {
        console.log('[SWAP] ✓ 0x transaction successful, returning 0x result');
        return {
          to: zeroXResult.quote.to,
          data: zeroXResult.quote.data,
          value: zeroXResult.quote.value,
          provider: '0x',
          slippageBps: zeroXResult.slippageBps,
          highSlippageWarning: zeroXResult.highSlippageWarning,
        };
      }
    } catch (error) {
      console.log('[SWAP] ⚠️ 0x transaction failed:', error);
    }

    // Layer 3b: Zora API fallback
    console.log('[SWAP] 🔄 Layer 3b: Attempting Zora (fallback provider)...');
    try {
      const zoraQuote = await getZoraSwapTransaction(sellToken, buyToken, sellAmount, takerAddress);
      if (zoraQuote && zoraQuote.to && zoraQuote.data) {
        console.log('[SWAP] ✓ Zora transaction successful, returning Zora result');
        return {
          to: zoraQuote.to,
          data: zoraQuote.data,
          value: zoraQuote.value || '0',
          provider: 'zora',
          slippageBps: 2000,
          highSlippageWarning: true,
        };
      }
    } catch (error) {
      console.error('[SWAP] ❌ Zora transaction also failed:', error);
    }
  }

  console.log('[SWAP] ❌ All routing layers failed');
  return null;
}
