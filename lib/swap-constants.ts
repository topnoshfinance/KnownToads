// Swap-related constants shared between components and API

// USDC token address on Base chain
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Base chain ID
export const BASE_CHAIN_ID = 8453;

// Available swap amounts in USDC
export const SWAP_AMOUNTS = [1, 5, 10, 25, 50, 100] as const;

// Slippage configuration
export const SLIPPAGE_TIERS = [0.03, 0.05, 0.08] as const; // 3%, 5%, 8%
export const DEFAULT_SLIPPAGE_MODE: 'auto' | 'manual' = 'auto';
export const DEFAULT_CUSTOM_SLIPPAGE = 3; // 3%

// Token address validation regex (0x followed by 40 hex characters)
export const TOKEN_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Validation function for token address
export function isValidTokenAddress(address: string): boolean {
  return TOKEN_ADDRESS_REGEX.test(address);
}

// Validation function for chain ID
export function isValidChainId(chainId: number): boolean {
  return chainId === BASE_CHAIN_ID;
}

// Validation function for swap amount
export function isValidSwapAmount(amount: number): boolean {
  return (SWAP_AMOUNTS as readonly number[]).includes(amount);
}
