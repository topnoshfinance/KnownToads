import { Address } from 'viem';

// 0x Exchange Proxy contract on Base
export const ZEROX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as Address;

// USDC on Base
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

// Base chain ID
export const BASE_CHAIN_ID = 8453;

// 0x API base URL
const ZEROX_API_BASE_URL = 'https://api.0x.org';

// Slippage tolerance: 3%
export const SLIPPAGE_PERCENTAGE = 0.03;

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
}

/**
 * Get a price quote from 0x API
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Quote data or null if no liquidity
 */
export async function get0xQuote(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<QuoteResult | null> {
  try {
    const params = new URLSearchParams({
      chainId: BASE_CHAIN_ID.toString(),
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      takerAddress,
      slippagePercentage: SLIPPAGE_PERCENTAGE.toString(),
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
      console.error('0x API error:', response.status, errorText);
      
      if (response.status === 404) {
        // No liquidity available
        return null;
      }
      
      throw new Error(`0x API error: ${response.status}`);
    }

    const quote: ZeroXQuote = await response.json();
    
    return {
      amountOut: BigInt(quote.buyAmount),
      price: quote.price,
      estimatedGas: quote.estimatedGas,
    };
  } catch (error) {
    console.error('Error fetching 0x quote:', error);
    return null;
  }
}

/**
 * Get a swap transaction from 0x API
 * @param sellToken - Token to sell (e.g., USDC)
 * @param buyToken - Token to buy
 * @param sellAmount - Amount to sell in base units
 * @param takerAddress - Address of the user making the swap
 * @returns Transaction data or null if no liquidity
 */
export async function get0xSwapTransaction(
  sellToken: Address,
  buyToken: Address,
  sellAmount: bigint,
  takerAddress: Address
): Promise<ZeroXQuote | null> {
  try {
    const params = new URLSearchParams({
      chainId: BASE_CHAIN_ID.toString(),
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      takerAddress,
      slippagePercentage: SLIPPAGE_PERCENTAGE.toString(),
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
      console.error('0x API error:', response.status, errorText);
      
      if (response.status === 404) {
        // No liquidity available
        return null;
      }
      
      throw new Error(`0x API error: ${response.status}`);
    }

    const quote: ZeroXQuote = await response.json();
    return quote;
  } catch (error) {
    console.error('Error fetching 0x swap transaction:', error);
    return null;
  }
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
