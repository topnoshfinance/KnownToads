/**
 * Zora Coins SDK Integration
 * Uses @zoralabs/coins-sdk for trading Zora creator coins
 * 
 * Note: Zora Coins SDK is designed for trading coins with native ETH/currency,
 * not ERC20 tokens like USDC. This implementation provides a wrapper that
 * calculates slippage protection for the trades.
 */

import { tradeCoin, simulateBuy, setApiKey } from '@zoralabs/coins-sdk';
import { Address, WalletClient, PublicClient } from 'viem';
import { BASE_CHAIN_ID, SLIPPAGE_TIERS } from './swap-constants';

// Set Zora API key if available
if (process.env.ZORA_API_KEY) {
  setApiKey(process.env.ZORA_API_KEY);
} else if (process.env.NEXT_PUBLIC_ZORA_API_KEY) {
  setApiKey(process.env.NEXT_PUBLIC_ZORA_API_KEY);
}

export type SlippageMode = 'auto' | 'manual';

export interface TradeParams {
  sellAmount: bigint; // Amount to spend (in wei for native currency)
  buyToken: Address; // Creator coin address
  userAddress: Address;
  slippageMode: SlippageMode;
  customSlippage?: number; // For manual mode (as decimal, e.g., 0.03 for 3%)
  walletClient: WalletClient;
  publicClient: PublicClient;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  slippageUsed?: number;
}

export interface QuoteResult {
  amountOut: bigint;
  slippageUsed: number;
  error?: string;
}

/**
 * Get a quote for buying a creator coin
 */
export async function getTradeQuote(
  orderSize: bigint,
  buyToken: Address,
  publicClient: PublicClient
): Promise<QuoteResult | null> {
  try {
    console.log('[Zora Trade] Getting quote...', {
      orderSize: orderSize.toString(),
      buyToken,
    });

    const simulation = await simulateBuy({
      target: buyToken,
      requestedOrderSize: orderSize,
      publicClient,
    });

    return {
      amountOut: simulation.amountOut,
      slippageUsed: 0, // Quote doesn't include slippage
    };
  } catch (error) {
    console.error('[Zora Trade] Quote error:', error);
    return null;
  }
}

/**
 * Execute a trade using Zora SDK with progressive slippage fallback
 * In auto mode: tries 3% → 5% → 8%
 * In manual mode: uses custom slippage only
 */
export async function executeTrade(params: TradeParams): Promise<TradeResult> {
  const {
    sellAmount,
    buyToken,
    userAddress,
    slippageMode,
    customSlippage,
    walletClient,
    publicClient,
  } = params;

  // Determine slippage values to try
  const slippagesToTry: number[] = 
    slippageMode === 'auto' 
      ? [...SLIPPAGE_TIERS] 
      : [customSlippage || SLIPPAGE_TIERS[0]];

  console.log('[Zora Trade] Starting trade execution', {
    mode: slippageMode,
    slippages: slippagesToTry,
    sellAmount: sellAmount.toString(),
  });

  // Try each slippage tier
  for (let i = 0; i < slippagesToTry.length; i++) {
    const slippage = slippagesToTry[i];
    const isLastAttempt = i === slippagesToTry.length - 1;

    try {
      console.log(`[Zora Trade] Attempt ${i + 1}/${slippagesToTry.length} with ${(slippage * 100).toFixed(1)}% slippage`);

      // First, simulate the buy to get expected output
      const simulation = await simulateBuy({
        target: buyToken,
        requestedOrderSize: sellAmount,
        publicClient,
      });

      // Calculate minimum amount out based on slippage
      const minAmountOut = simulation.amountOut * BigInt(Math.floor((1 - slippage) * 10000)) / BigInt(10000);

      console.log('[Zora Trade] Simulation:', {
        expectedOut: simulation.amountOut.toString(),
        minAmountOut: minAmountOut.toString(),
        slippage: (slippage * 100).toFixed(1) + '%',
      });

      // Execute trade using Zora SDK
      const result = await tradeCoin(
        {
          direction: 'buy', // We're buying the creator coin
          target: buyToken, // The creator coin address
          args: {
            recipient: userAddress,
            orderSize: sellAmount, // Amount we're spending
            minAmountOut, // Minimum tokens to receive (with slippage protection)
          },
        },
        walletClient,
        publicClient
      );

      console.log('[Zora Trade] Trade successful!', {
        slippage,
        txHash: result?.hash,
      });

      return {
        success: true,
        txHash: result?.hash,
        slippageUsed: slippage,
      };
    } catch (error: any) {
      console.error(`[Zora Trade] Attempt ${i + 1} failed:`, error);

      // If this is the last attempt, return the error
      if (isLastAttempt) {
        return {
          success: false,
          error: extractErrorMessage(error),
          slippageUsed: slippage,
        };
      }

      // Otherwise, continue to next slippage tier
      console.log(`[Zora Trade] Trying next slippage tier...`);
    }
  }

  // Should never reach here, but just in case
  return {
    success: false,
    error: 'All slippage attempts failed',
  };
}

/**
 * Extract user-friendly error message from error object
 */
function extractErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  
  if (error?.message) {
    // Check for common error patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('insufficient liquidity') || message.includes('no liquidity')) {
      return 'No liquidity available for this token';
    }
    
    if (message.includes('insufficient balance') || message.includes('insufficient funds')) {
      return 'Insufficient balance';
    }
    
    if (message.includes('slippage')) {
      return 'Price moved too much. Please try again with higher slippage.';
    }
    
    if (message.includes('user rejected') || message.includes('user denied')) {
      return 'Transaction rejected by user';
    }
    
    if (message.includes('network') || message.includes('chain')) {
      return 'Please ensure you are connected to Base network';
    }

    if (message.includes('api key')) {
      return 'API key configuration error. Please contact support.';
    }
    
    // Return original message if no pattern matches
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Format slippage for display
 */
export function formatSlippage(slippage: number): string {
  return `${(slippage * 100).toFixed(1)}%`;
}

/**
 * Get slippage display string based on mode
 */
export function getSlippageDisplay(mode: SlippageMode, customSlippage?: number): string {
  if (mode === 'auto') {
    return `Auto (${formatSlippage(SLIPPAGE_TIERS[0])} → ${formatSlippage(SLIPPAGE_TIERS[1])} → ${formatSlippage(SLIPPAGE_TIERS[2])})`;
  }
  
  return formatSlippage((customSlippage || SLIPPAGE_TIERS[0]) / 100);
}
