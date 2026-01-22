import { Address, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// ERC-20 ABI for symbol and decimals functions
const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

/**
 * Get the public client for Base chain
 */
function getBasePublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(),
  });
}

/**
 * Fetch the ERC-20 token symbol from contract
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token symbol or null if not available
 */
export async function fetchTokenSymbol(tokenAddress: Address): Promise<string | null> {
  try {
    const client = getBasePublicClient();
    const symbol = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    });
    return symbol as string;
  } catch (error) {
    console.error('Error fetching token symbol:', error);
    return null;
  }
}

/**
 * Fetch the ERC-20 token decimals from contract
 * @param tokenAddress - ERC-20 token contract address
 * @returns Token decimals or 18 (default) if not available
 */
export async function fetchTokenDecimals(tokenAddress: Address): Promise<number> {
  try {
    const client = getBasePublicClient();
    const decimals = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
    return Number(decimals);
  } catch (error) {
    console.error('Error fetching token decimals:', error);
    return 18; // Default to 18 decimals
  }
}

/**
 * Fetch both symbol and decimals for a token
 * @param tokenAddress - ERC-20 token contract address
 * @returns Object with symbol and decimals
 */
export async function fetchTokenInfo(tokenAddress: Address): Promise<{
  symbol: string;
  decimals: number;
}> {
  const [symbol, decimals] = await Promise.all([
    fetchTokenSymbol(tokenAddress),
    fetchTokenDecimals(tokenAddress),
  ]);

  return {
    symbol: symbol || 'TOKEN',
    decimals,
  };
}
