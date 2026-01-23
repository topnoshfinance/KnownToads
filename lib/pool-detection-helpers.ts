import { Address, createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { PoolKey } from './v4-quoter-helpers';

// Uniswap V4 PoolManager on Base
const POOL_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_UNISWAP_V4_POOL_MANAGER || '0x498581ff718922c3f8e6a244956af099b2652b2b') as Address;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

// Create viem client
const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

// Pool cache with 24hr TTL
const poolCache = new Map<string, {
  pools: PoolKey[];
  cachedAt: number;
}>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Pool detection result
 */
export interface PoolDetectionResult {
  found: boolean;
  pools: PoolKey[];
  primaryPool?: PoolKey; // Best pool to use (highest liquidity/most used)
}

/**
 * Detect V4 pools for a given token address
 * Searches PoolManager Initialize events for pools containing the token
 */
export async function detectV4Pools(
  tokenAddress: Address
): Promise<PoolDetectionResult> {
  const cacheKey = tokenAddress.toLowerCase();
  
  // Check cache first
  const cached = poolCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    console.log('[Pool Detection] Using cached pools for', tokenAddress);
    return {
      found: cached.pools.length > 0,
      pools: cached.pools,
      primaryPool: cached.pools[0], // First pool as primary
    };
  }

  console.log('[Pool Detection] Scanning for pools with token:', tokenAddress);

  try {
    // Query PoolManager Initialize events
    // Event signature: Initialize(PoolKey indexed key, uint160 sqrtPriceX96, int24 tick)
    const initializeEvent = parseAbiItem(
      'event Initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) indexed key, uint160 sqrtPriceX96, int24 tick)'
    );

    // Scan last 10,000 blocks (adjust based on network activity)
    // Base block time is ~2 seconds, so 10,000 blocks = ~5.5 hours
    // This provides recent pool data while avoiding overly expensive queries
    const currentBlock = await baseClient.getBlockNumber();
    const fromBlock = currentBlock - 10000n;

    const logs = await baseClient.getLogs({
      address: POOL_MANAGER_ADDRESS,
      event: initializeEvent,
      fromBlock,
      toBlock: 'latest',
    });

    console.log(`[Pool Detection] Found ${logs.length} Initialize events`);

    // Filter pools that contain our token and have hooks
    const matchingPools: PoolKey[] = [];

    for (const log of logs) {
      const { key } = log.args;
      
      // Handle undefined key
      if (!key) continue;
      
      const { currency0, currency1, fee, tickSpacing, hooks } = key;

      // Check if pool contains our token
      const hasToken = 
        currency0.toLowerCase() === tokenAddress.toLowerCase() ||
        currency1.toLowerCase() === tokenAddress.toLowerCase();

      // Check if pool has hooks (non-zero address)
      const hasHooks = hooks.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

      if (hasToken) {
        matchingPools.push({
          currency0,
          currency1,
          fee,
          tickSpacing,
          hooks,
        });

        if (hasHooks) {
          console.log('[Pool Detection] ✓ Found pool with hooks:', {
            currency0,
            currency1,
            fee,
            hooks,
          });
        }
      }
    }

    // Cache the results
    poolCache.set(cacheKey, {
      pools: matchingPools,
      cachedAt: Date.now(),
    });

    console.log(`[Pool Detection] Found ${matchingPools.length} total pools for token`);

    return {
      found: matchingPools.length > 0,
      pools: matchingPools,
      primaryPool: matchingPools[0], // Use first pool as primary (can enhance with liquidity checks)
    };
  } catch (error) {
    console.error('[Pool Detection] Error scanning pools:', error);
    return {
      found: false,
      pools: [],
    };
  }
}

/**
 * Detect pools with Zora API fallback for creator coins
 */
export async function detectPoolsWithZoraFallback(
  tokenAddress: Address
): Promise<PoolDetectionResult> {
  // First try on-chain detection
  const onChainResult = await detectV4Pools(tokenAddress);
  
  if (onChainResult.found) {
    return onChainResult;
  }

  // Fallback to Zora API for creator coins
  console.log('[Pool Detection] On-chain detection failed, trying Zora API...');
  
  try {
    const zoraApiKey = process.env.ZORA_API_KEY;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (zoraApiKey) {
      headers['api-key'] = zoraApiKey;
    }

    const response = await fetch(
      `https://api-sdk.zora.engineering/pool/8453/${tokenAddress}`,
      { headers }
    );

    if (response.ok) {
      const data = await response.json();
      
      // Convert Zora pool data to PoolKey format
      if (data.poolKey) {
        const poolKey: PoolKey = {
          currency0: data.poolKey.currency0,
          currency1: data.poolKey.currency1,
          fee: data.poolKey.fee,
          tickSpacing: data.poolKey.tickSpacing,
          hooks: data.poolKey.hooks || ZERO_ADDRESS,
        };

        console.log('[Pool Detection] ✓ Found pool via Zora API');

        // Cache this result too
        poolCache.set(tokenAddress.toLowerCase(), {
          pools: [poolKey],
          cachedAt: Date.now(),
        });

        return {
          found: true,
          pools: [poolKey],
          primaryPool: poolKey,
        };
      }
    }
  } catch (error) {
    console.error('[Pool Detection] Zora API fallback failed:', error);
  }

  console.log('[Pool Detection] ❌ No pools found for token');
  return {
    found: false,
    pools: [],
  };
}
