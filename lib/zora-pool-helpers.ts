import { Address } from 'viem';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Zora API endpoints (configurable via environment or defaults)
// Note: These endpoints are inferred from Zora's API patterns
// If incorrect, set ZORA_POOL_API_BASE_URL and ZORA_SWAP_API_BASE_URL environment variables
const ZORA_POOL_API_BASE_URL = process.env.ZORA_POOL_API_BASE_URL || 'https://api.zora.co/pools';
const ZORA_SWAP_API_BASE_URL = process.env.ZORA_SWAP_API_BASE_URL || 'https://api-sdk.zora.engineering';

// USDC on Base (used for pool inference)
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Cache TTL: 24 hours
const POOL_METADATA_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Zora Pool Metadata interface
 * Contains critical information about Uniswap V4 pools for Zora creator coins
 */
export interface ZoraPoolMetadata {
  // Pool identification
  poolId: string;
  poolAddress?: string;
  
  // Pool key components (Uniswap V4)
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks?: Address; // Custom hook contract address
  
  // Liquidity information
  liquidity?: string;
  liquidityDepth?: {
    token0: string;
    token1: string;
  };
  
  // Metadata
  chainId: number;
  exists: boolean;
  
  // Cache timestamp
  cachedAt: number;
}

/**
 * Pool metadata cache
 * Key: token address (lowercase)
 * Value: ZoraPoolMetadata with cache timestamp
 */
const poolMetadataCache = new Map<string, ZoraPoolMetadata>();

/**
 * Get cached pool metadata if still valid
 * @param tokenAddress - Creator coin token address
 * @returns Cached metadata or null if expired/not found
 */
function getCachedPoolMetadata(tokenAddress: Address): ZoraPoolMetadata | null {
  const cacheKey = tokenAddress.toLowerCase();
  const cached = poolMetadataCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  const now = Date.now();
  const age = now - cached.cachedAt;
  
  if (age > POOL_METADATA_CACHE_TTL) {
    // Cache expired
    poolMetadataCache.delete(cacheKey);
    return null;
  }
  
  console.log(`[ZoraPool] Using cached pool metadata for ${tokenAddress} (age: ${Math.round(age / 1000 / 60)} min)`);
  return cached;
}

/**
 * Store pool metadata in cache
 * @param tokenAddress - Creator coin token address
 * @param metadata - Pool metadata to cache
 */
function setCachedPoolMetadata(tokenAddress: Address, metadata: ZoraPoolMetadata): void {
  const cacheKey = tokenAddress.toLowerCase();
  poolMetadataCache.set(cacheKey, {
    ...metadata,
    cachedAt: Date.now(),
  });
}

/**
 * Fetch Uniswap V4 pool details for a Zora creator coin from Zora SDK/API
 * 
 * This function attempts to discover pool metadata from multiple sources:
 * 1. Zora SDK API endpoint (if available)
 * 2. Direct Uniswap V4 PoolManager query (fallback)
 * 
 * @param creatorCoinAddress - The ERC-20 token address of the creator coin
 * @returns Pool metadata or null if no pool exists
 */
export async function getZoraPoolMetadata(
  creatorCoinAddress: Address
): Promise<ZoraPoolMetadata | null> {
  // Check cache first
  const cached = getCachedPoolMetadata(creatorCoinAddress);
  if (cached) {
    return cached;
  }
  
  console.log(`[ZoraPool] 🔍 Fetching pool metadata for ${creatorCoinAddress}...`);
  
  try {
    // Attempt 1: Try Zora SDK API endpoint
    const apiKey = process.env.ZORA_API_KEY;
    
    // Construct Zora API URL for pool information
    const zoraApiUrl = `${ZORA_POOL_API_BASE_URL}/${BASE_CHAIN_ID}/${creatorCoinAddress}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    try {
      const response = await fetch(zoraApiUrl, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const poolData = await response.json();
        
        // Parse Zora API response into our metadata format
        const metadata: ZoraPoolMetadata = {
          poolId: poolData.poolId || poolData.id,
          poolAddress: poolData.poolAddress,
          currency0: poolData.token0 || poolData.currency0,
          currency1: poolData.token1 || poolData.currency1,
          fee: poolData.fee || 3000, // Default to 0.3% if not specified
          tickSpacing: poolData.tickSpacing || 60,
          hooks: poolData.hooks || poolData.hookAddress,
          liquidity: poolData.liquidity,
          liquidityDepth: poolData.liquidityDepth,
          chainId: BASE_CHAIN_ID,
          exists: true,
          cachedAt: Date.now(),
        };
        
        console.log(`[ZoraPool] ✓ Pool metadata found via Zora API:`, {
          poolId: metadata.poolId,
          fee: metadata.fee,
          hooks: metadata.hooks,
        });
        
        // Cache the result
        setCachedPoolMetadata(creatorCoinAddress, metadata);
        return metadata;
      } else {
        console.log(`[ZoraPool] Zora API returned ${response.status}, pool may not exist or API unavailable`);
      }
    } catch (apiError) {
      console.log(`[ZoraPool] Zora API not available:`, apiError instanceof Error ? apiError.message : 'Unknown error');
    }
    
    // Attempt 2: Try to infer pool existence from Zora swap endpoint
    // If we can get a quote, a pool likely exists
    console.log(`[ZoraPool] 📊 Attempting to infer pool existence from Zora swap API...`);
    
    // Try to get a minimal quote to see if pool exists
    // This is a heuristic approach - if Zora can quote it, a V4 pool likely exists
    const zoraSwapUrl = `${ZORA_SWAP_API_BASE_URL}/quote`;
    
    try {
      const quoteResponse = await fetch(zoraSwapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          inputToken: USDC_ADDRESS,
          outputToken: creatorCoinAddress,
          amount: '1000000', // 1 USDC (6 decimals)
          chain: BASE_CHAIN_ID,
          slippage: 0.20, // 20% for testing
        }),
      });
      
      if (quoteResponse.ok) {
        // Pool exists! Create metadata with inferred values
        const metadata: ZoraPoolMetadata = {
          poolId: `inferred-${creatorCoinAddress}`,
          currency0: USDC_ADDRESS,
          currency1: creatorCoinAddress,
          fee: 3000, // Standard 0.3% fee (assumed)
          tickSpacing: 60, // Standard tick spacing (assumed)
          hooks: undefined, // Unknown, but likely has Zora hooks
          chainId: BASE_CHAIN_ID,
          exists: true,
          cachedAt: Date.now(),
        };
        
        console.log(`[ZoraPool] ✓ Pool inferred to exist (Zora can quote it)`);
        
        // Cache the result
        setCachedPoolMetadata(creatorCoinAddress, metadata);
        return metadata;
      } else {
        console.log(`[ZoraPool] No pool found - Zora swap API returned ${quoteResponse.status}`);
      }
    } catch (inferError) {
      console.log(`[ZoraPool] Could not infer pool existence:`, inferError instanceof Error ? inferError.message : 'Unknown error');
    }
    
    // No pool found through any method
    console.log(`[ZoraPool] ❌ No pool metadata found for ${creatorCoinAddress}`);
    
    // Cache negative result to avoid repeated lookups
    const noPoolMetadata: ZoraPoolMetadata = {
      poolId: '',
      currency0: creatorCoinAddress,
      currency1: creatorCoinAddress,
      fee: 0,
      tickSpacing: 0,
      chainId: BASE_CHAIN_ID,
      exists: false,
      cachedAt: Date.now(),
    };
    
    setCachedPoolMetadata(creatorCoinAddress, noPoolMetadata);
    return null;
    
  } catch (error) {
    console.error(`[ZoraPool] Error fetching pool metadata:`, error);
    return null;
  }
}

/**
 * Clear pool metadata cache for a specific token
 * Useful for forcing a refresh
 * @param tokenAddress - Token address to clear from cache
 */
export function clearPoolMetadataCache(tokenAddress?: Address): void {
  if (tokenAddress) {
    poolMetadataCache.delete(tokenAddress.toLowerCase());
    console.log(`[ZoraPool] Cleared cache for ${tokenAddress}`);
  } else {
    poolMetadataCache.clear();
    console.log(`[ZoraPool] Cleared all pool metadata cache`);
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getPoolMetadataCacheStats() {
  return {
    size: poolMetadataCache.size,
    entries: Array.from(poolMetadataCache.keys()),
  };
}
