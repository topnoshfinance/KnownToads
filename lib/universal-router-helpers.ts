/**
 * @deprecated This file contains legacy Universal Router integration.
 * The application now uses Zora Coins SDK exclusively for all swaps.
 * This file should not be used in new code.
 * 
 * See: lib/zora-trade-helpers.ts for the new implementation using @zoralabs/coins-sdk
 */

import { Address, encodeFunctionData, encodeAbiParameters, parseAbiParameters, formatUnits } from 'viem';
import { getV4Quote, PoolKey } from './v4-quoter-helpers';
import { detectPoolsWithZoraFallback } from './pool-detection-helpers';

// Universal Router on Base
export const UNIVERSAL_ROUTER_ADDRESS = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD' as Address;

// USDC on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Default slippage tolerance in basis points (10%)
export const DEFAULT_SLIPPAGE_BPS = 1000;

// High slippage warning threshold in basis points (10%)
export const HIGH_SLIPPAGE_WARNING_BPS = 1000;

// Default fee tier for Uniswap V3 (0.3%)
// NOTE: This may not exist for all token pairs. In production, consider:
// 1. Implementing fee tier detection via pool queries
// 2. Trying multiple fee tiers as fallbacks (500, 3000, 10000 basis points)
// 3. Using a quoter contract to find the best route
export const DEFAULT_FEE_TIER = 3000;

// Commands for Universal Router
const Commands = {
  // V3 commands (kept for backwards compatibility)
  V3_SWAP_EXACT_IN: '0x00',
  V3_SWAP_EXACT_OUT: '0x01',
  // V4 command
  V4_SWAP: '0x10',
  // Other commands
  PERMIT2_TRANSFER_FROM: '0x0a',
  PERMIT2_PERMIT_BATCH: '0x0b',
  SWEEP: '0x0c',
  TRANSFER: '0x0d',
  PAY_PORTION: '0x0e',
} as const;

// V4 Actions for swap encoding
// Based on Uniswap V4 documentation
const V4Actions = {
  SWAP_EXACT_IN_SINGLE: '0x00',
  SWAP_EXACT_IN: '0x01',
  SWAP_EXACT_OUT_SINGLE: '0x02',
  SWAP_EXACT_OUT: '0x03',
  SETTLE_ALL: '0x10',
  SETTLE_PAIR: '0x11',
  TAKE_ALL: '0x12',
  TAKE_PAIR: '0x13',
  SETTLE: '0x14',
  TAKE: '0x15',
  CLOSE_CURRENCY: '0x16',
  CLEAR_OR_TAKE: '0x17',
  SWEEP: '0x18',
} as const;

// Empty hook data constant for V4 swaps
const EMPTY_HOOK_DATA = '0x' as const;

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
 * Encode V4 swap action parameters for Universal Router
 * Based on Uniswap V4 documentation
 */
function encodeV4SwapExactInSingle(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
  hookData: `0x${string}` = '0x' as const
): `0x${string}` {
  // Parameters for SWAP_EXACT_IN_SINGLE action:
  // - PoolKey struct (currency0, currency1, fee, tickSpacing, hooks)
  // - bool zeroForOne (direction of swap)
  // - uint128 amountIn
  // - uint128 amountOutMinimum
  // - bytes hookData
  
  return encodeAbiParameters(
    parseAbiParameters([
      '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey',
      'bool zeroForOne',
      'uint128 amountIn',
      'uint128 amountOutMinimum',
      'bytes hookData'
    ].join(', ')),
    [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amountIn,
      amountOutMinimum,
      hookData,
    ]
  );
}

/**
 * Get swap quote using V4 Quoter with automatic pool detection
 */
export async function getUniversalRouterQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): Promise<{ amountOut: bigint; amountOutMinimum: bigint; gasEstimate: bigint; poolKey?: PoolKey } | null> {
  console.log('[Universal Router] Starting quote with pool detection...');
  
  // Step 1: Detect pools for the buy token
  const poolDetection = await detectPoolsWithZoraFallback(buyToken);
  
  if (!poolDetection.found || !poolDetection.primaryPool) {
    console.error('[Universal Router] No pools found for token');
    return null;
  }

  const poolKey = poolDetection.primaryPool;
  console.log('[Universal Router] Using pool:', poolKey);

  // Step 2: Get quote from V4 Quoter
  const quote = await getV4Quote(poolKey, sellToken, buyToken, sellAmount);
  
  if (!quote) {
    console.error('[Universal Router] Quote failed');
    return null;
  }

  // Step 3: Calculate minimum output with slippage
  const amountOutMinimum = calculateMinimumOutput(quote.amountOut, slippageBps);

  console.log('[Universal Router] ✓ Quote complete', {
    amountOut: quote.amountOut.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    slippageBps,
  });

  return {
    amountOut: quote.amountOut,
    amountOutMinimum,
    gasEstimate: quote.gasEstimate,
    poolKey,
  };
}

/**
 * Build Universal Router swap transaction using V3 commands (legacy)
 * Kept as fallback for V3 pools
 */
export async function getUniversalRouterSwapTransactionV3(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  recipient: Address,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): Promise<{ to: Address; data: string; value: string; poolKey?: PoolKey } | null> {
  try {
    console.log('[Universal Router V3] Building swap transaction...');
    console.log('[Universal Router V3] Params:', {
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      recipient,
      slippageBps,
    });
    
    // Get quote with pool detection
    const quote = await getUniversalRouterQuote(sellToken, buyToken, sellAmount, slippageBps);
    if (!quote) {
      console.error('[Universal Router V3] Failed to get quote');
      return null;
    }

    // Use the fee from detected pool if available, otherwise use default
    const feeTier = quote.poolKey?.fee || DEFAULT_FEE_TIER;
    
    // Encode the V3 path (using detected or default fee tier)
    const path = encodeV3Path(sellToken, buyToken, feeTier);
    
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

    console.log('[Universal Router V3] ✓ Transaction built successfully');
    console.log('[Universal Router V3] Expected out:', quote.amountOut.toString());
    console.log('[Universal Router V3] Min out:', quote.amountOutMinimum.toString());
    
    return {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data,
      value: '0', // No ETH needed for ERC20 swaps
      poolKey: quote.poolKey,
    };
  } catch (error) {
    console.error('[Universal Router V3] Error building transaction:', error);
    return null;
  }
}

/**
 * Build Universal Router swap transaction using V4 commands
 * Uses V4_SWAP command (0x10) with proper action sequence
 */
export async function getUniversalRouterSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  recipient: Address,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): Promise<{ to: Address; data: string; value: string; poolKey?: PoolKey } | null> {
  try {
    console.log('[Universal Router] Building V4 swap transaction...');
    
    // Get quote with pool detection
    const quote = await getUniversalRouterQuote(sellToken, buyToken, sellAmount, slippageBps);
    if (!quote || !quote.poolKey) {
      console.error('[Universal Router] Failed to get quote or pool key');
      return null;
    }

    const poolKey = quote.poolKey;
    
    // Determine swap direction (zeroForOne)
    // If selling currency0, zeroForOne = true; if selling currency1, zeroForOne = false
    const zeroForOne = sellToken.toLowerCase() === poolKey.currency0.toLowerCase();
    
    console.log('[Universal Router] Swap direction:', { 
      zeroForOne, 
      sellToken, 
      currency0: poolKey.currency0, 
      currency1: poolKey.currency1 
    });

    // Build V4 action sequence:
    // 1. SETTLE_ALL - deposit input tokens
    // 2. SWAP_EXACT_IN_SINGLE - execute swap
    // 3. TAKE_ALL - withdraw output tokens
    
    // Concatenate action bytes properly
    const actionBytes = [
      V4Actions.SETTLE_ALL,
      V4Actions.SWAP_EXACT_IN_SINGLE,
      V4Actions.TAKE_ALL,
    ].map(action => action.slice(2)).join('');
    const actions = `0x${actionBytes}` as `0x${string}`;
    
    // Encode parameters for each action
    const settleParams = encodeAbiParameters(
      parseAbiParameters('address currency, uint256 amount, bool payerIsUser'),
      [sellToken, sellAmount, true]
    );
    
    const swapParams = encodeV4SwapExactInSingle(
      poolKey,
      zeroForOne,
      sellAmount,
      quote.amountOutMinimum,
      EMPTY_HOOK_DATA
    );
    
    // TAKE_ALL with CONTRACT_BALANCE (type(uint128).max) to take all available tokens
    const takeParams = encodeAbiParameters(
      parseAbiParameters('address currency, address recipient, uint256 amount'),
      [buyToken, recipient, 0n] // 0 means take all available balance in V4
    );
    
    // Combine all action parameters
    const params = [settleParams, swapParams, takeParams];
    
    // Encode the V4_SWAP input
    const v4SwapInput = encodeAbiParameters(
      parseAbiParameters('bytes actions, bytes[] params'),
      [actions, params]
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

    // Encode the execute function call with V4_SWAP command
    const data = encodeFunctionData({
      abi: executeAbi,
      functionName: 'execute',
      args: [
        Commands.V4_SWAP, // Use 0x10 for V4 swaps
        [v4SwapInput], // V4 swap input
        deadline,
      ],
    });

    console.log('[Universal Router] ✓ V4 transaction built successfully');
    console.log('[Universal Router] Pool:', poolKey);
    console.log('[Universal Router] Expected out:', quote.amountOut.toString());
    console.log('[Universal Router] Min out:', quote.amountOutMinimum.toString());
    
    return {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data,
      value: '0', // No ETH needed for ERC20 swaps
      poolKey: quote.poolKey,
    };
  } catch (error) {
    console.error('[Universal Router] Error building V4 transaction:', error);
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
  // Convert using formatUnits to avoid BigInt precision loss
  const inputAmount = parseFloat(formatUnits(amountIn, inputDecimals));
  const outputAmount = parseFloat(formatUnits(amountOut, outputDecimals));
  
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
