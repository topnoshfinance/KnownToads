import { Address, encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';

// Universal Router on Base
export const UNIVERSAL_ROUTER_ADDRESS = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD' as Address;

// USDC on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Commands for Universal Router
const Commands = {
  V3_SWAP_EXACT_IN: '0x00',
  V3_SWAP_EXACT_OUT: '0x01',
  PERMIT2_TRANSFER_FROM: '0x0a',
  PERMIT2_PERMIT_BATCH: '0x0b',
  SWEEP: '0x0c',
  TRANSFER: '0x0d',
  PAY_PORTION: '0x0e',
} as const;

/**
 * Encode V3 swap parameters for Universal Router
 * Using V3 since it's more widely supported than V4
 */
function encodeV3SwapExactIn(
  recipient: Address,
  amountIn: bigint,
  amountOutMinimum: bigint,
  path: `0x${string}`,
  payerIsUser: boolean
): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('address, uint256, uint256, bytes, bool'),
    [recipient, amountIn, amountOutMinimum, path, payerIsUser]
  );
}

/**
 * Encode path for V3 swap (tokenIn, fee, tokenOut)
 */
function encodeV3Path(tokenIn: Address, tokenOut: Address, fee: number): `0x${string}` {
  // V3 path encoding: address (20 bytes) + fee (3 bytes) + address (20 bytes)
  const tokenInHex = tokenIn.slice(2); // Remove '0x'
  const tokenOutHex = tokenOut.slice(2); // Remove '0x'
  const feeHex = fee.toString(16).padStart(6, '0'); // 3 bytes = 6 hex chars
  
  return `0x${tokenInHex}${feeHex}${tokenOutHex}` as `0x${string}`;
}

/**
 * Get swap quote from Universal Router
 * Note: Universal Router doesn't have a quote endpoint, so we estimate based on typical slippage
 * In production, consider using Uniswap V3 Quoter contract for accurate quotes
 */
export async function getUniversalRouterQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  slippageBps: number = 1000 // 10% default
): Promise<{ amountOutMinimum: bigint; estimatedOut: bigint } | null> {
  try {
    // For now, we'll use a conservative estimate
    // TODO: Implement proper Quoter V2 integration for accurate quotes
    // Quoter V2 on Base: 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
    
    console.log('[Universal Router] Quote estimation (placeholder)');
    
    // Conservative estimate: assume 1:1 for now (needs proper quoter)
    const slippageFactor = BigInt(10000 - slippageBps);
    const estimatedOut = sellAmount; // Placeholder: should query actual pool
    const amountOutMinimum = (estimatedOut * slippageFactor) / 10000n;
    
    return {
      amountOutMinimum,
      estimatedOut,
    };
  } catch (error) {
    console.error('[Universal Router] Error getting quote:', error);
    return null;
  }
}

/**
 * Build Universal Router swap transaction
 * Uses V3 swap exact input command
 */
export async function getUniversalRouterSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  recipient: Address,
  slippageBps: number = 1000
): Promise<{ to: Address; data: string; value: string } | null> {
  try {
    console.log('[Universal Router] Building swap transaction...');
    console.log('[Universal Router] Params:', {
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      recipient,
      slippageBps,
    });
    
    const quote = await getUniversalRouterQuote(sellToken, buyToken, sellAmount, slippageBps);
    if (!quote) {
      console.error('[Universal Router] Failed to get quote');
      return null;
    }

    // Encode the V3 path (using 0.3% fee tier as default)
    const fee = 3000; // 0.3% fee tier
    const path = encodeV3Path(sellToken, buyToken, fee);
    
    // Encode V3 swap parameters
    const swapParams = encodeV3SwapExactIn(
      recipient,
      sellAmount,
      quote.amountOutMinimum,
      path,
      true // payer is user
    );

    // Calculate deadline (5 minutes from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Universal Router execute ABI
    const executeAbi = [
      {
        name: 'execute',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: 'commands', type: 'bytes' },
          { name: 'inputs', type: 'bytes[]' },
          { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const;

    // Encode the execute function call
    const data = encodeFunctionData({
      abi: executeAbi,
      functionName: 'execute',
      args: [
        Commands.V3_SWAP_EXACT_IN, // Single command
        [swapParams], // Single input
        deadline,
      ],
    });

    console.log('[Universal Router] ✓ Transaction built successfully');
    console.log('[Universal Router] Estimated out:', quote.estimatedOut.toString());
    console.log('[Universal Router] Min out:', quote.amountOutMinimum.toString());
    
    return {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data,
      value: '0', // No ETH needed for ERC20 swaps
    };
  } catch (error) {
    console.error('[Universal Router] Error building transaction:', error);
    return null;
  }
}

/**
 * Calculate minimum output amount with slippage tolerance
 */
export function calculateMinimumOutput(
  expectedOutput: bigint,
  slippageBps: number = 1000
): bigint {
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
