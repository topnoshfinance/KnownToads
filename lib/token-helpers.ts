import { Address, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { getCoin } from '@zoralabs/coins-sdk';

// ERC-20 ABI for symbol, decimals, and name functions
const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

// In-memory cache for token metadata (24hr TTL)
const tokenMetadataCache = new Map<string, {
  name: string;
  symbol: string;
  decimals: number;
  cachedAt: number;
}>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get the public client for Base chain
 */
function getBasePublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(),
  });
}

/**
 * Fetch the ERC-20 token symbol using Zora SDK with RPC fallback
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token symbol or null if not available
 */
export async function fetchTokenSymbol(tokenAddress: Address): Promise<string | null> {
  // Check cache first
  const cacheKey = tokenAddress.toLowerCase();
  const cached = tokenMetadataCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.symbol || null;
  }

  try {
    // Try Zora SDK first (for Zora coins)
    const response = await getCoin({
      address: tokenAddress,
      chain: base.id,
    });
    
    const symbol = response.data?.zora20Token?.symbol;
    if (symbol) {
      // Cache the result
      // Note: Zora coins are standard ERC-20 tokens with 18 decimals
      tokenMetadataCache.set(cacheKey, {
        name: response.data?.zora20Token?.name || '',
        symbol,
        decimals: 18,
        cachedAt: Date.now(),
      });
      return symbol;
    }
  } catch (error) {
    console.log('[Token] Not a Zora coin or API error, trying RPC fallback');
  }

  // Fallback to RPC for non-Zora tokens
  try {
    const client = getBasePublicClient();
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }).catch(() => 18), // Default to 18 if decimals() fails
    ]);
    
    if (symbol) {
      tokenMetadataCache.set(cacheKey, {
        name: '',
        symbol: symbol as string,
        decimals: Number(decimals) || 18,
        cachedAt: Date.now(),
      });
    }
    return (symbol as string) || null;
  } catch (error) {
    console.error('[Token] RPC fallback also failed:', error);
    return null;
  }
}

/**
 * Fetch the ERC-20 token decimals from contract
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token decimals or 18 (default) if not available
 */
export async function fetchTokenDecimals(tokenAddress: Address): Promise<number> {
  try {
    const client = getBasePublicClient();
    const decimals = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
    return Number(decimals);
  } catch (error) {
    console.error('Error fetching token decimals:', error);
    return 18; // Default to 18 decimals
  }
}

/**
 * Fetch both symbol and decimals for a token
 * @param tokenAddress - ERC-20 token contract address
 * @returns Object with symbol and decimals
 */
export async function fetchTokenInfo(tokenAddress: Address): Promise<{
  symbol: string;
  decimals: number;
}> {
  const [symbol, decimals] = await Promise.all([
    fetchTokenSymbol(tokenAddress),
    fetchTokenDecimals(tokenAddress),
  ]);

  return {
    symbol: symbol || 'TOKEN',
    decimals,
  };
}

/**
 * Fetch token symbol with retry logic and caching
 * Tries up to 3 times with increasing delays (500ms, 1000ms, 1500ms)
 * Returns the symbol on first success or null after all retries fail
 * @param tokenAddress - ERC-20 token contract address
 * @param retries - Number of retry attempts (default: 3)
 * @returns Token symbol or null if not available after all retries
 */
export async function fetchTokenSymbolWithRetry(
  tokenAddress: Address,
  retries = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const symbol = await fetchTokenSymbol(tokenAddress);
      if (symbol) {
        return symbol;
      }
    } catch (error) {
      console.error(`[Token Symbol] Attempt ${attempt}/${retries} failed for ${tokenAddress}:`, error);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  return null;
}

/**
 * Fetch token name from contract
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token name or null if not available
 */
export async function fetchTokenName(tokenAddress: Address): Promise<string | null> {
  try {
    const client = getBasePublicClient();
    const name = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'name',
    });
    return name as string;
  } catch (error) {
    console.error('Error fetching token name:', error);
    return null;
  }
}

/**
 * Get token name with caching and Zora API fallback
 * Tries multiple sources:
 * 1. In-memory cache (24hr TTL)
 * 2. Token contract (name() function)
 * 3. Zora API
 * 4. Token contract symbol as fallback
 * 
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token name or 'Token' as ultimate fallback
 */
export async function getTokenName(tokenAddress: Address): Promise<string> {
  const cacheKey = tokenAddress.toLowerCase();
  const cached = tokenMetadataCache.get(cacheKey);
  
  // Return cached if fresh
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.name || 'Token';
  }

  try {
    // Try to get name from token contract first
    const contractName = await fetchTokenName(tokenAddress);
    if (contractName && contractName.trim() !== '') {
      // Cache the result
      const symbol = await fetchTokenSymbol(tokenAddress);
      const decimals = await fetchTokenDecimals(tokenAddress);
      
      tokenMetadataCache.set(cacheKey, {
        name: contractName,
        symbol: symbol || '',
        decimals,
        cachedAt: Date.now(),
      });
      
      return contractName;
    }

    // Fallback to Zora API for additional metadata
    const zoraApiKey = process.env.ZORA_API_KEY;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (zoraApiKey) {
      headers['api-key'] = zoraApiKey;
    }

    const response = await fetch(
      `https://api-sdk.zora.engineering/token/${tokenAddress}?chainId=8453`,
      { headers }
    );

    if (response.ok) {
      const data = await response.json();
      const name = data.name || data.symbol || 'Token';
      
      // Cache the result
      const symbol = data.symbol || await fetchTokenSymbol(tokenAddress);
      const decimals = data.decimals || await fetchTokenDecimals(tokenAddress);
      
      tokenMetadataCache.set(cacheKey, {
        name,
        symbol: symbol || '',
        decimals,
        cachedAt: Date.now(),
      });
      
      return name;
    }
  } catch (error) {
    console.error('[Token Metadata] Error fetching token name:', error);
  }

  // Final fallback: try to get symbol from contract
  try {
    const symbol = await fetchTokenSymbol(tokenAddress);
    if (symbol) {
      return symbol;
    }
  } catch (error) {
    console.error('[Token Metadata] Error fetching token symbol:', error);
  }

  // Ultimate fallback
  return 'Token';
}

/**
 * Token metadata interface
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  totalSupply?: string;
  marketCap?: string;
  volume24h?: string;
  creatorAddress?: string;
}

/**
 * Get complete token metadata using Zora SDK with RPC fallback
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token metadata or null if not available
 */
export async function getTokenMetadata(tokenAddress: Address): Promise<TokenMetadata | null> {
  try {
    // Try Zora SDK first (for Zora coins)
    const response = await getCoin({
      address: tokenAddress,
      chain: base.id,
    });
    
    const coin = response.data?.zora20Token;
    if (coin) {
      return {
        name: coin.name || '',
        symbol: coin.symbol || '',
        decimals: 18, // Zora coins are standard ERC-20 tokens with 18 decimals
        description: coin.description || undefined,
        totalSupply: coin.totalSupply || undefined,
        volume24h: coin.volume24h || undefined,
        creatorAddress: coin.creatorAddress || undefined,
      };
    }
  } catch (error) {
    console.log('[Token] Not a Zora coin or API error, trying RPC fallback');
  }

  // Fallback to RPC for non-Zora tokens
  try {
    const client = getBasePublicClient();
    const [symbol, name, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => ''),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name',
      }).catch(() => ''),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }).catch(() => 18),
    ]);
    
    if (symbol || name) {
      return {
        name: (name as string) || '',
        symbol: (symbol as string) || '',
        decimals: Number(decimals) || 18,
      };
    }
  } catch (error) {
    console.error('[Token] Error fetching metadata from RPC:', error);
  }

  return null;
}
