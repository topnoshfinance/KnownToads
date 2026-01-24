/**
 * Zora Coins SDK Integration
 * Uses @zoralabs/coins-sdk for trading Zora creator coins
 * 
 * NOTE: The installed SDK version (0.2.1) appears to use a different API than 
 * the documentation provided. The SDK's tradeCoin function is designed for 
 * buying/selling Zora coins with native currency (ETH), not ERC20 to ERC20 swaps.
 * 
 * This implementation uses the actual SDK API available in v0.2.1.
 * If USDC to Creator Coin swaps are needed, the SDK may need to be updated
 * or a different trading mechanism used.
 */

import { tradeCoin, simulateBuy, setApiKey, TradeParams } from '@zoralabs/coins-sdk';
import { Address, WalletClient, PublicClient, Account, parseUnits } from 'viem';
import { USDC_ADDRESS, BASE_CHAIN_ID, SLIPPAGE_TIERS } from './swap-constants';

// Set Zora API key if available
if (process.env.ZORA_API_KEY) {
  setApiKey(process.env.ZORA_API_KEY);
} else if (process.env.NEXT_PUBLIC_ZORA_API_KEY) {
  setApiKey(process.env.NEXT_PUBLIC_ZORA_API_KEY);
}

export type SlippageMode = 'auto' | 'manual';

export interface TradeParameters {
  sellAmount: bigint; // Amount in wei (for ETH) or base units (for USDC)
  buyToken: Address; // Creator coin address
  userAddress: Address;
  slippageMode: SlippageMode;
  customSlippage?: number; // For manual mode (as percentage, e.g., 3 for 3%)
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
 * Execute a trade using Zora SDK with progressive slippage fallback
 * In auto mode: tries 3% → 5% → 8%
 * In manual mode: uses custom slippage only
 * 
 * Uses the SDK's tradeCoin function which buys Zora coins
 */
export async function executeTrade(params: TradeParameters): Promise<TradeResult> {
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
      : [customSlippage ? customSlippage / 100 : SLIPPAGE_TIERS[0]]; // Convert percentage to decimal

  console.log('[Zora Trade] Starting trade execution', {
    mode: slippageMode,
    slippages: slippagesToTry.map(s => `${(s * 100).toFixed(1)}%`),
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

      // Set up trade parameters for the SDK
      const tradeParams: TradeParams = {
        direction: 'buy', // We're buying the creator coin
        target: buyToken, // The creator coin address
        args: {
          recipient: userAddress,
          orderSize: sellAmount, // Amount we're spending
          minAmountOut, // Minimum tokens to receive (with slippage protection)
        },
      };

      // Execute trade using Zora SDK (3 parameter signature)
      const result = await tradeCoin(
        tradeParams,
        walletClient,
        publicClient
      );

      console.log('[Zora Trade] Trade successful!', {
        slippage: (slippage * 100).toFixed(1) + '%',
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
    
    if (message.includes('slippage') || message.includes('price')) {
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
  
  // customSlippage is already a percentage (3 for 3%), so just format it
  return `${(customSlippage || (SLIPPAGE_TIERS[0] * 100)).toFixed(1)}%`;
}
