/**
 * Zora Coins SDK Integration
 * Uses @zoralabs/coins-sdk for all trading operations
 */

import { tradeCoin, setApiKey } from '@zoralabs/coins-sdk';
import { Address, WalletClient, PublicClient, Account } from 'viem';
import { USDC_ADDRESS, BASE_CHAIN_ID, SLIPPAGE_TIERS } from './swap-constants';

// Set Zora API key if available
if (process.env.ZORA_API_KEY) {
  setApiKey(process.env.ZORA_API_KEY);
} else if (process.env.NEXT_PUBLIC_ZORA_API_KEY) {
  setApiKey(process.env.NEXT_PUBLIC_ZORA_API_KEY);
}

export type SlippageMode = 'auto' | 'manual';

export interface TradeParams {
  sellAmount: bigint; // USDC amount with 6 decimals
  buyToken: Address; // Creator coin address
  userAddress: Address;
  slippageMode: SlippageMode;
  customSlippage?: number; // For manual mode (as decimal, e.g., 0.03 for 3%)
  walletClient: WalletClient;
  account: Account;
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
 * Get a quote for trading USDC to creator coin
 */
export async function getTradeQuote(
  sellAmount: bigint,
  buyToken: Address,
  userAddress: Address,
  slippage: number
): Promise<QuoteResult | null> {
  try {
    console.log('[Zora Trade] Getting quote...', {
      sellAmount: sellAmount.toString(),
      buyToken,
      slippage,
    });

    // Note: The actual SDK might have a separate quote function
    // For now, we'll use tradeCoin in a dry-run mode if available
    // This is a placeholder - adjust based on actual SDK API
    
    return {
      amountOut: 0n, // Will be populated by actual SDK call
      slippageUsed: slippage,
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
    account,
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

      // Execute trade using Zora SDK
      const result = await tradeCoin({
        chainId: BASE_CHAIN_ID,
        sell: {
          type: 'erc20' as const,
          address: USDC_ADDRESS,
        },
        buy: {
          type: 'erc20' as const,
          address: buyToken,
        },
        amountIn: sellAmount,
        slippage,
        sender: userAddress,
        walletClient,
        account,
        publicClient,
      });

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
      return 'Insufficient USDC balance';
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
