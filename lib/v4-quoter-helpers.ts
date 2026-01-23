import { Address, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Uniswap V4 Quoter on Base
export const V4_QUOTER_ADDRESS = (process.env.NEXT_PUBLIC_UNISWAP_V4_QUOTER || '0x0d5e0f971ed27fbff6c2837bf31316121532048d') as Address;

// Pool key structure for V4
export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

// Quoter ABI (minimal interface needed)
const QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'poolKey', type: 'tuple', components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' },
          ]},
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

/**
 * Create viem client for Base
 */
const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

/**
 * Get swap quote from Uniswap V4 Quoter
 * @param poolKey - Pool identification (includes tokens, fee, hooks)
 * @param tokenIn - Input token address
 * @param tokenOut - Output token address
 * @param amountIn - Input amount in base units
 * @returns Quote with expected output amount and gas estimate
 */
export async function getV4Quote(
  poolKey: PoolKey,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ amountOut: bigint; gasEstimate: bigint } | null> {
  try {
    // Determine trade direction (zeroForOne = true if tokenIn < tokenOut)
    const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
    
    console.log('[V4 Quoter] Fetching quote...', {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      zeroForOne,
      poolKey,
    });

    const result = await baseClient.readContract({
      address: V4_QUOTER_ADDRESS,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [{
        poolKey,
        zeroForOne,
        amountIn,
        sqrtPriceLimitX96: 0n, // No price limit
        hookData: '0x', // Empty hook data for standard quotes
      }],
    });

    const [amountOut, gasEstimate] = result;

    console.log('[V4 Quoter] ✓ Quote successful', {
      amountOut: amountOut.toString(),
      gasEstimate: gasEstimate.toString(),
    });

    return { amountOut, gasEstimate };
  } catch (error) {
    console.error('[V4 Quoter] Error fetching quote:', error);
    return null;
  }
}

/**
 * Calculate minimum output with slippage tolerance
 */
export function calculateMinimumOutput(
  expectedOutput: bigint,
  slippageBps: number
): bigint {
  const slippageFactor = 10000 - slippageBps;
  return (expectedOutput * BigInt(slippageFactor)) / 10000n;
}
