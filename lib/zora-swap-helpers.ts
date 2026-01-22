import { Address } from 'viem';

// Zora API configuration
const ZORA_API_BASE_URL = 'https://api-sdk.zora.engineering';
const BASE_CHAIN_ID = 8453;

// Slippage tolerance: 3%
const SLIPPAGE_PERCENTAGE = 0.03;

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
    // Prepare request body for Zora's /quote endpoint
    const requestBody = {
      inputToken: sellToken,
      outputToken: buyToken,
      amount: sellAmount.toString(),
      chain: BASE_CHAIN_ID,
      userAddress: takerAddress,
      slippage: SLIPPAGE_PERCENTAGE,
    };

    const apiKey = process.env.ZORA_API_KEY;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['api-key'] = apiKey;
    }

    // Log the request for debugging
    console.debug('Zora API Request:', {
      url: `${ZORA_API_BASE_URL}/quote`,
      method: 'POST',
      body: requestBody,
    });

    const response = await fetch(
      `${ZORA_API_BASE_URL}/quote`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      }
    );

    // Log response status for debugging
    console.debug('Zora API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zora API error response:', {
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
    
    // Log successful response for debugging
    console.debug('Zora API successful response:', {
      chainId: quote.chainId,
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
      hasTransactionData: !!(quote.to && quote.data),
    });
    
    return quote;
  } catch (error) {
    console.error('Error fetching Zora quote:', error);
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
