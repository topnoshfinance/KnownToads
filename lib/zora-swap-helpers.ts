/**
 * Zora API swap integration
 * Uses Zora REST API for fetching quotes
 */

import { Address } from 'viem';

// Zora API configuration
const ZORA_API_BASE_URL = 'https://api-sdk.zora.engineering';
const BASE_CHAIN_ID = 8453;

// Default slippage for Zora API quotes (5%)
const ZORA_QUOTE_SLIPPAGE = 0.05;

/**
 * Zora API swap quote response type
 */
export interface ZoraSwapQuote {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  to: string;
  data: string;
  value: string;
  gas?: string;
  gasPrice?: string;
}

/**
 * Get a swap quote from Zora API
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy (creator coin)
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Zora swap quote or null if no liquidity or error
 */
export async function getZoraQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<ZoraSwapQuote | null> {
  try {
    // Prepare request body for Zora's /quote endpoint (correct schema from Zora SDK)
    const requestBody = {
      tokenIn: {
        type: "erc20",
        address: sellToken,
      },
      tokenOut: {
        type: "erc20",
        address: buyToken,
      },
      amountIn: sellAmount.toString(),
      chainId: BASE_CHAIN_ID,
      sender: takerAddress,
      recipient: takerAddress,
      slippage: ZORA_QUOTE_SLIPPAGE,
    };

    const apiKey = process.env.ZORA_API_KEY;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['api-key'] = apiKey;
    }

    // Enhanced logging for Zora API request
    console.log('[Zora] API Request:', {
      url: `${ZORA_API_BASE_URL}/quote`,
      method: 'POST',
      body: requestBody,
      slippageUsed: `${(ZORA_QUOTE_SLIPPAGE * 100).toFixed(1)}%`,
    });

    const response = await fetch(
      `${ZORA_API_BASE_URL}/quote`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      }
    );

    // Log response status
    console.log('[Zora] API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Zora] API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      // No liquidity or route not available
      if (response.status === 404 || response.status === 400) {
        return null;
      }
      
      throw new Error(`Zora API error: ${response.status}`);
    }

    const quote: ZoraSwapQuote = await response.json();
    
    // Log successful response
    console.log('[Zora] API successful response:', {
      chainId: quote.chainId,
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
      hasTransactionData: !!(quote.to && quote.data),
    });
    
    return quote;
  } catch (error) {
    console.error('[Zora] Error fetching quote:', error);
    return null;
  }
}

/**
 * Get swap transaction data from Zora API
 * Note: This is currently an alias for getZoraQuote since Zora returns
 * transaction data in the quote response. Kept as a separate function for
 * consistency with the 0x API pattern and for future flexibility if Zora
 * separates quote and transaction endpoints.
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy (creator coin)
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Zora swap transaction data or null if no liquidity or error
 */
export async function getZoraSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<ZoraSwapQuote | null> {
  return getZoraQuote(sellToken, buyToken, sellAmount, takerAddress);
}
