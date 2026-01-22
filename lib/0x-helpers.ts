import { Address } from 'viem';
import { getZoraQuote, getZoraSwapTransaction, type ZoraSwapQuote } from './zora-swap-helpers';

// 0x Exchange Proxy contract on Base
export const ZEROX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as Address;

// USDC on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Base chain ID
export const BASE_CHAIN_ID = 8453;

// 0x API base URL
const ZEROX_API_BASE_URL = 'https://api.0x.org';

// Progressive slippage levels for Zora creator/post coins on shallow Uniswap V4 pools
// These coins often have low liquidity, requiring higher slippage tolerance
export const SLIPPAGE_LEVELS = [0.05, 0.10, 0.15]; // 5%, 10%, 15%

// Default slippage tolerance: 10%
export const SLIPPAGE_PERCENTAGE = 0.10;

/**
 * Swap provider type
 */
export type SwapProvider = 'zora' | '0x';

/**
 * 0x API quote response type
 */
export interface ZeroXQuote {
  buyAmount: string;
  sellAmount: string;
  price: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  estimatedGas: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
}

/**
 * Simplified quote result for UI display
 */
export interface QuoteResult {
  amountOut: bigint;
  price: string;
  estimatedGas: string;
  provider?: SwapProvider;
  slippageUsed?: number; // The slippage percentage that was successfully used for this quote
}

/**
 * Get a price quote from 0x API with progressive slippage retry
 * Tries multiple slippage levels for Zora creator/post coins on shallow Uniswap V4 pools
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Quote data or null if no liquidity at any slippage level
 */
export async function get0xQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<QuoteResult | null> {
  // Try each slippage level progressively
  for (const slippage of SLIPPAGE_LEVELS) {
    try {
      console.log(`Attempting 0x quote with ${(slippage * 100).toFixed(0)}% slippage...`);
      
      const params = new URLSearchParams({
        chainId: BASE_CHAIN_ID.toString(),
        sellToken,
        buyToken,
        sellAmount: sellAmount.toString(),
        takerAddress,
        slippagePercentage: slippage.toString(),
      });

      const apiKey = process.env.ZEROX_API_KEY;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['0x-api-key'] = apiKey;
      }

      const response = await fetch(
        `${ZEROX_API_BASE_URL}/swap/v1/quote?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`0x API error at ${(slippage * 100).toFixed(0)}% slippage:`, response.status, errorText);
        
        if (response.status === 404) {
          // No liquidity at this slippage level, try next
          continue;
        }
        
        // For other errors, also try next slippage level
        continue;
      }

      const quote: ZeroXQuote = await response.json();
      
      console.log(`✓ 0x quote successful at ${(slippage * 100).toFixed(0)}% slippage`);
      
      return {
        amountOut: BigInt(quote.buyAmount),
        price: quote.price,
        estimatedGas: quote.estimatedGas,
        slippageUsed: slippage,
      };
    } catch (error) {
      console.error(`Error fetching 0x quote at ${(slippage * 100).toFixed(0)}% slippage:`, error);
      // Continue to next slippage level
      continue;
    }
  }
  
  // All slippage levels failed
  console.log('0x quote failed at all slippage levels');
  return null;
}

/**
 * Get a swap transaction from 0x API with progressive slippage retry
 * Tries multiple slippage levels for Zora creator/post coins on shallow Uniswap V4 pools
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Transaction data or null if no liquidity at any slippage level
 */
export async function get0xSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<ZeroXQuote | null> {
  // Try each slippage level progressively
  for (const slippage of SLIPPAGE_LEVELS) {
    try {
      console.log(`Attempting 0x swap transaction with ${(slippage * 100).toFixed(0)}% slippage...`);
      
      const params = new URLSearchParams({
        chainId: BASE_CHAIN_ID.toString(),
        sellToken,
        buyToken,
        sellAmount: sellAmount.toString(),
        takerAddress,
        slippagePercentage: slippage.toString(),
      });

      const apiKey = process.env.ZEROX_API_KEY;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['0x-api-key'] = apiKey;
      }

      const response = await fetch(
        `${ZEROX_API_BASE_URL}/swap/v1/quote?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`0x API error at ${(slippage * 100).toFixed(0)}% slippage:`, response.status, errorText);
        
        if (response.status === 404) {
          // No liquidity at this slippage level, try next
          continue;
        }
        
        // For other errors, also try next slippage level
        continue;
      }

      const quote: ZeroXQuote = await response.json();
      
      console.log(`✓ 0x swap transaction successful at ${(slippage * 100).toFixed(0)}% slippage`);
      
      return quote;
    } catch (error) {
      console.error(`Error fetching 0x swap transaction at ${(slippage * 100).toFixed(0)}% slippage:`, error);
      // Continue to next slippage level
      continue;
    }
  }
  
  // All slippage levels failed
  console.log('0x swap transaction failed at all slippage levels');
  return null;
}

/**
 * Calculate minimum output amount with slippage tolerance
 * @param expectedOutput - Expected output amount from quote
 * @param slippagePercentage - Slippage tolerance as decimal (default: 0.03 = 3%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinimumOutput(
  expectedOutput: bigint,
  slippagePercentage: number = SLIPPAGE_PERCENTAGE
): bigint {
  // amountOutMinimum = expectedOutput * (1 - slippage)
  const slippageFactor = 1 - slippagePercentage;
  const slippageFactorBigInt = BigInt(Math.floor(slippageFactor * 10000));
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

/**
 * Smart routing: Get swap quote from Zora first, fallback to 0x
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Quote data with provider info or null if no liquidity
 */
export async function getSwapQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<QuoteResult | null> {
  // Try Zora first
  try {
    const zoraQuote = await getZoraQuote(sellToken, buyToken, sellAmount, takerAddress);
    if (zoraQuote && zoraQuote.buyAmount) {
      return {
        amountOut: BigInt(zoraQuote.buyAmount),
        price: '0', // Zora doesn't provide price field
        estimatedGas: zoraQuote.gas || '0',
        provider: 'zora',
      };
    }
  } catch (error) {
    console.debug('Zora quote unavailable, trying 0x fallback...', error);
  }

  // Fallback to 0x
  try {
    const zeroXQuote = await get0xQuote(sellToken, buyToken, sellAmount, takerAddress);
    if (zeroXQuote) {
      return {
        ...zeroXQuote,
        provider: '0x',
      };
    }
  } catch (error) {
    console.error('0x quote also failed:', error);
  }

  return null;
}

/**
 * Smart routing: Get swap transaction from Zora first, fallback to 0x
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Transaction data with provider or null if no liquidity
 */
export async function getSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<{ to: string; data: string; value: string; provider: SwapProvider } | null> {
  // Try Zora first
  try {
    const zoraQuote = await getZoraSwapTransaction(sellToken, buyToken, sellAmount, takerAddress);
    if (zoraQuote && zoraQuote.to && zoraQuote.data) {
      return {
        to: zoraQuote.to,
        data: zoraQuote.data,
        value: zoraQuote.value || '0',
        provider: 'zora',
      };
    }
  } catch (error) {
    console.debug('Zora transaction unavailable, trying 0x fallback...', error);
  }

  // Fallback to 0x
  try {
    const zeroXQuote = await get0xSwapTransaction(sellToken, buyToken, sellAmount, takerAddress);
    if (zeroXQuote) {
      return {
        to: zeroXQuote.to,
        data: zeroXQuote.data,
        value: zeroXQuote.value,
        provider: '0x',
      };
    }
  } catch (error) {
    console.error('0x transaction also failed:', error);
  }

  return null;
}
