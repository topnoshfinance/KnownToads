import { createPublicClient, http, isAddress, Address } from 'viem';
import { base } from 'viem/chains';

const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

// ERC-20 ABI for validation
const erc20Abi = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

export interface ContractValidationResult {
  valid: boolean;
  chainId?: number;
  symbol?: string;
  decimals?: number;
  error?: string;
}

/**
 * Validates that an address is a valid ERC-20 token contract on Base
 */
export async function validateERC20Contract(
  address: string
): Promise<ContractValidationResult> {
  // Check if valid Ethereum address format
  if (!isAddress(address)) {
    return {
      valid: false,
      error: 'Invalid address format',
    };
  }

  try {
    // Try to read ERC-20 standard functions
    const [totalSupply, decimals, symbol] = await Promise.all([
      baseClient.readContract({
        address: address as Address,
        abi: erc20Abi,
        functionName: 'totalSupply',
      }),
      baseClient.readContract({
        address: address as Address,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      baseClient.readContract({
        address: address as Address,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
    ]);

    // If all calls succeed, it's a valid ERC-20 token
    return {
      valid: true,
      chainId: base.id,
      symbol: symbol as string,
      decimals: Number(decimals),
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Contract does not implement ERC-20 standard or does not exist on Base',
    };
  }
}

/**
 * Validates X (Twitter) handle format
 */
export function validateXHandle(handle: string): boolean {
  if (!handle) return true; // Optional field
  // Remove @ if present, validate alphanumeric + underscore, 1-15 chars
  const cleaned = handle.startsWith('@') ? handle.slice(1) : handle;
  return /^[a-zA-Z0-9_]{1,15}$/.test(cleaned);
}

/**
 * Normalizes Telegram handle by removing @ or https://t.me/ prefix
 */
export function normalizeTelegramHandle(handle: string): string {
  if (!handle) return '';
  
  // Remove https://t.me/ prefix
  let cleaned = handle.replace(/^https?:\/\/t\.me\//i, '');
  
  // Remove @ prefix
  cleaned = cleaned.replace(/^@/, '');
  
  return cleaned;
}

/**
 * Validates Telegram handle format
 */
export function validateTelegramHandle(handle: string): boolean {
  if (!handle) return true; // Optional field
  const normalized = normalizeTelegramHandle(handle);
  // Telegram usernames: 5-32 chars, alphanumeric + underscore
  return /^[a-zA-Z0-9_]{5,32}$/.test(normalized);
}

/**
 * Validates Zora page URL format
 */
export function validateZoraUrl(url: string): boolean {
  if (!url) return true; // Optional field
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'zora.co' || parsed.hostname.endsWith('.zora.co');
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is accessible (returns 200-399 status)
 */
export async function checkUrlHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  }
}
