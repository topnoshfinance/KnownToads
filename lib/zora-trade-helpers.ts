/**
 * Zora Coins SDK Integration
 * Uses @zoralabs/coins-sdk v0.4.0 for trading Zora creator coins
 * 
 * This implementation uses the new v0.4.x API which supports USDC to Creator Coin swaps
 * via ERC20 to ERC20 trading with automatic permit signature handling.
 */

import { tradeCoin, setApiKey, TradeParameters as SDKTradeParameters } from '@zoralabs/coins-sdk';
import { Address, WalletClient, PublicClient, Account } from 'viem';
import { USDC_ADDRESS, BASE_CHAIN_ID, SLIPPAGE_TIERS } from './swap-constants';

// Set Zora API key if available
if (process.env.ZORA_API_KEY) {
  setApiKey(process.env.ZORA_API_KEY);
} else if (process.env.NEXT_PUBLIC_ZORA_API_KEY) {
  setApiKey(process.env.NEXT_PUBLIC_ZORA_API_KEY);
}

export type SlippageMode = 'auto' | 'manual';

export interface TradeParameters {
  sellAmount: bigint; // Amount in base units (6 decimals for USDC)
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
 * Get a price quote from 0x API
 * Uses 0x Swap API to fetch real-time price data for USDC to creator coin swaps
 * The 0x API aggregates liquidity from Uniswap V4 pools where creator coins trade
 * 
 * @param sellToken - Token to sell (typically USDC)
 * @param buyToken - Token to buy (creator coin)
 * @param sellAmount - Amount to sell in base units
 * @param userAddress - User's wallet address (optional)
 * @returns Quote with amountOut or null if error
 */
export async function getZoraSDKQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  userAddress?: Address
): Promise<{ amountOut: bigint } | null> {
  try {
    const apiKey = process.env.ZEROX_API_KEY || process.env.NEXT_PUBLIC_ZEROX_API_KEY;
    
    const params = new URLSearchParams({
      chainId: BASE_CHAIN_ID.toString(),
      sellToken: sellToken,
      buyToken: buyToken,
      sellAmount: sellAmount.toString(),
      ...(userAddress && { takerAddress: userAddress }),
    });

    const headers: HeadersInit = {};
    
    if (apiKey) {
      headers['0x-api-key'] = apiKey;
    }

    console.log('[0x Quote] Fetching quote:', { sellToken, buyToken, sellAmount: sellAmount.toString() });

    const response = await fetch(
      `https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[0x Quote] API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return null;
    }

    const quote = await response.json();
    
    console.log('[0x Quote] Successful response:', {
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount,
    });
    
    return {
      amountOut: BigInt(quote.buyAmount),
    };
  } catch (error) {
    console.error('[0x Quote] Error fetching quote:', error);
    return null;
  }
}

/**
 * Execute a trade using Zora SDK with progressive slippage fallback
 * In auto mode: tries 3% → 5% → 8%
 * In manual mode: uses custom slippage only
 * 
 * Uses the SDK's tradeCoin function which swaps USDC for Zora creator coins
 * The SDK handles permit signatures automatically for USDC (no separate approval needed)
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

      // Set up trade parameters for the new SDK API
      const tradeParameters: SDKTradeParameters = {
        sell: {
          type: "erc20",
          address: USDC_ADDRESS, // USDC on Base
        },
        buy: {
          type: "erc20",
          address: buyToken, // Creator Coin address
        },
        amountIn: sellAmount, // USDC amount (6 decimals)
        slippage, // Slippage as decimal (e.g., 0.05 for 5%)
        sender: userAddress,
      };

      console.log('[Zora Trade] Executing trade with parameters:', {
        sellToken: USDC_ADDRESS,
        buyToken,
        amountIn: sellAmount.toString(),
        slippage: (slippage * 100).toFixed(1) + '%',
        sender: userAddress,
      });

      // Execute trade using Zora SDK (new v0.4.x API)
      const receipt = await tradeCoin({
        tradeParameters,
        walletClient,
        account,
        publicClient,
      });

      console.log('[Zora Trade] Trade successful!', {
        slippage: (slippage * 100).toFixed(1) + '%',
        txHash: receipt?.transactionHash,
      });

      return {
        success: true,
        txHash: receipt?.transactionHash,
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
