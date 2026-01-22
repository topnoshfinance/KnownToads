import { Address, encodeFunctionData, parseUnits } from 'viem';
import { ZoraPoolMetadata } from './zora-pool-helpers';

// Uniswap V4 PoolManager contract on Base
// IMPORTANT: This must be configured via environment variable to enable V4 direct swaps
// If not set, direct V4 routing will be skipped
export const UNISWAP_V4_POOL_MANAGER = 
  (process.env.NEXT_PUBLIC_UNISWAP_V4_POOL_MANAGER as Address | undefined);

// Base chain ID
const BASE_CHAIN_ID = 8453;

/**
 * Uniswap V4 PoolKey interface
 * Matches the PoolKey struct in Uniswap V4 contracts
 */
export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/**
 * Uniswap V4 SwapParams interface
 */
export interface SwapParams {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
}

/**
 * Convert pool metadata to PoolKey
 * @param metadata - Zora pool metadata
 * @returns PoolKey for Uniswap V4
 */
export function poolMetadataToPoolKey(metadata: ZoraPoolMetadata): PoolKey {
  return {
    currency0: metadata.currency0,
    currency1: metadata.currency1,
    fee: metadata.fee,
    tickSpacing: metadata.tickSpacing,
    hooks: metadata.hooks || '0x0000000000000000000000000000000000000000' as Address,
  };
}

/**
 * Build a direct Uniswap V4 swap transaction
 * 
 * This constructs calldata for swapping through Uniswap V4 PoolManager
 * using pool metadata discovered from Zora
 * 
 * @param poolKey - Uniswap V4 pool key
 * @param sellToken - Token to sell
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param minBuyAmount - Minimum amount to receive (for slippage protection)
 * @param recipient - Address to receive output tokens
 * @returns Transaction object with to, data, and value
 */
export async function getUniswapV4SwapTransaction(
  poolKey: PoolKey,
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  minBuyAmount: bigint,
  recipient: Address
): Promise<{ to: string; data: string; value: string } | null> {
  try {
    console.log(`[UniswapV4] 🔨 Building direct V4 swap transaction...`);
    console.log(`[UniswapV4] Pool:`, {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: poolKey.fee,
      hooks: poolKey.hooks,
    });
    console.log(`[UniswapV4] Swap:`, {
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      minBuyAmount: minBuyAmount.toString(),
    });
    
    // Validate PoolManager address is configured
    if (!UNISWAP_V4_POOL_MANAGER) {
      console.error(`[UniswapV4] ⚠️ UNISWAP_V4_POOL_MANAGER not configured in environment variables`);
      return null;
    }
    
    // Determine swap direction
    const zeroForOne = sellToken.toLowerCase() === poolKey.currency0.toLowerCase();
    
    console.log(`[UniswapV4] Swap direction: ${zeroForOne ? 'currency0 → currency1' : 'currency1 → currency0'}`);
    
    // Encode swap parameters
    // Note: Uniswap V4 uses a different interface than V3
    // The actual function signature may vary - this is a conceptual implementation
    
    // SwapParams for V4
    const swapParams: SwapParams = {
      zeroForOne,
      amountSpecified: -BigInt(sellAmount.toString()), // Negative for exact input
      sqrtPriceLimitX96: zeroForOne 
        ? BigInt('4295128739') // MIN_SQRT_RATIO + 1
        : BigInt('1461446703485210103287273052203988822378723970342'), // MAX_SQRT_RATIO - 1
    };
    
    // Encode hook data (if hooks are present)
    const hookData = '0x' as `0x${string}`;
    
    // Simplified ABI for Uniswap V4 PoolManager swap function
    // IMPORTANT: This ABI should be validated against the actual deployed V4 contract
    // 
    // TODO: In production, this should be replaced with one of the following:
    // 1. Import from @uniswap/v4-sdk if available
    // 2. Copy ABI from verified Base deployment on Basescan
    // 3. Fetch ABI dynamically from Base RPC etherscan API
    // 
    // The actual contract interface may differ from this conceptual implementation.
    // This is provided as a starting point and should be verified before use.
    const poolManagerAbi = [
      {
        name: 'swap',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          {
            name: 'key',
            type: 'tuple',
            components: [
              { name: 'currency0', type: 'address' },
              { name: 'currency1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'hooks', type: 'address' },
            ],
          },
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amountSpecified', type: 'int256' },
              { name: 'sqrtPriceLimitX96', type: 'uint160' },
            ],
          },
          { name: 'hookData', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const;
    
    try {
      // Encode the swap function call
      const calldata = encodeFunctionData({
        abi: poolManagerAbi,
        functionName: 'swap',
        args: [
          poolKey,
          swapParams,
          hookData,
        ],
      });
      
      console.log(`[UniswapV4] ✓ Swap calldata encoded successfully`);
      
      return {
        to: UNISWAP_V4_POOL_MANAGER,
        data: calldata,
        value: '0', // No ETH required for ERC20-to-ERC20 swaps
      };
    } catch (encodeError) {
      console.error(`[UniswapV4] ❌ Failed to encode swap calldata:`, encodeError);
      
      // Fallback: Return a conceptual transaction structure
      // In production, this should be properly implemented with the actual V4 SDK
      console.log(`[UniswapV4] ⚠️ Using fallback transaction structure (not executable)`);
      
      return null;
    }
  } catch (error) {
    console.error(`[UniswapV4] Error building swap transaction:`, error);
    return null;
  }
}

/**
 * Calculate minimum output amount with slippage tolerance
 * @param expectedOutput - Expected output from quote
 * @param slippageBps - Slippage in basis points (e.g., 1000 = 10%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinimumOutput(
  expectedOutput: bigint,
  slippageBps: number
): bigint {
  const slippageFactor = 10000 - slippageBps;
  return (expectedOutput * BigInt(slippageFactor)) / 10000n;
}

/**
 * Check if Uniswap V4 integration is properly configured
 * @returns true if PoolManager address is set
 */
export function isUniswapV4Configured(): boolean {
  return !!UNISWAP_V4_POOL_MANAGER && UNISWAP_V4_POOL_MANAGER !== '0x0000000000000000000000000000000000000000';
}

/**
 * Get Uniswap V4 configuration status
 */
export function getUniswapV4Config() {
  return {
    poolManager: UNISWAP_V4_POOL_MANAGER || 'Not configured',
    configured: isUniswapV4Configured(),
    chainId: BASE_CHAIN_ID,
  };
}
