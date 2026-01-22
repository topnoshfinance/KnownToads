import { Address } from 'viem';

// Zora API configuration
const ZORA_API_BASE_URL = 'https://api-sdk.zora.engineering';
const BASE_CHAIN_ID = 8453;

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
    const params = new URLSearchParams({
      chainId: BASE_CHAIN_ID.toString(),
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      takerAddress,
    });

    const apiKey = process.env.ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_API_KEY;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['api-key'] = apiKey;
    }

    const response = await fetch(
      `${ZORA_API_BASE_URL}/api/coinSwaps?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zora API error:', response.status, errorText);
      
      // No liquidity or route not available
      if (response.status === 404 || response.status === 400) {
        return null;
      }
      
      throw new Error(`Zora API error: ${response.status}`);
    }

    const quote: ZoraSwapQuote = await response.json();
    return quote;
  } catch (error) {
    console.error('Error fetching Zora quote:', error);
    return null;
  }
}

/**
 * Get swap transaction data from Zora API
 * This is the same as getZoraQuote since Zora returns transaction data in the quote
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
