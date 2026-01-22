import { Address } from 'viem';

// Uniswap V3 Quoter V2 address on Base
export const QUOTER_V2_ADDRESS = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as Address;

// Uniswap V3 SwapRouter address on Base
export const SWAP_ROUTER_ADDRESS = '0x2626664c2603336E57B271c5C0b26F421741e481' as Address;

// USDC on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Quoter V2 ABI (quoteExactInputSingle function)
export const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

// Fee tiers to try in order of likelihood (0.3%, 0.05%, 1%, 0.01%)
export const FEE_TIERS = [3000, 500, 10000, 100] as const;

// Fee tier display names
export const FEE_TIER_NAMES: Record<number, string> = {
  100: '0.01%',
  500: '0.05%',
  3000: '0.3%',
  10000: '1%',
};

// Slippage tolerance: 3% = 300 basis points
export const SLIPPAGE_BASIS_POINTS = 300n;

export interface QuoteResult {
  amountOut: bigint;
  fee: number;
  sqrtPriceX96After?: bigint;
  gasEstimate?: bigint;
}

/**
 * Try multiple fee tiers to find a pool with liquidity and get a quote
 * @param tokenIn - Input token address
 * @param tokenOut - Output token address
 * @param amountIn - Amount of input tokens
 * @param publicClient - Viem public client
 * @returns Quote result with amount out and fee tier, or null if no pool found
 */
export async function findPoolAndGetQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  publicClient: any
): Promise<QuoteResult | null> {
  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: QUOTER_V2_ADDRESS,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      // Check if we got a valid quote (amountOut > 0)
      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result.result;
      
      if (amountOut > 0n) {
        return {
          amountOut,
          fee,
          sqrtPriceX96After,
          gasEstimate,
        };
      }
    } catch (e) {
      // Pool doesn't exist or has no liquidity for this fee tier, try next
      continue;
    }
  }

  // No pool found with any fee tier
  return null;
}

/**
 * Calculate minimum output amount with slippage tolerance
 * @param expectedOutput - Expected output amount from quote
 * @param slippageBasisPoints - Slippage tolerance in basis points (default: 300 = 3%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinimumOutput(
  expectedOutput: bigint,
  slippageBasisPoints: bigint = SLIPPAGE_BASIS_POINTS
): bigint {
  // amountOutMinimum = expectedOutput * (10000 - slippage) / 10000
  return (expectedOutput * (10000n - slippageBasisPoints)) / 10000n;
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
