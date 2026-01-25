/**
 * Buy All Helpers
 * Functions for purchasing equal shares of all creator coins in the directory
 */

import { Address, WalletClient, PublicClient, Account } from 'viem';
import { Profile } from '@/types/profile';
import { executeTrade, SlippageMode, TradeResult } from './zora-trade-helpers';

export interface CoinQuote {
  address: string;
  symbol: string;
  amountUSDC: bigint;
  username: string;
}

export interface BuyAllQuote {
  coins: CoinQuote[];
  totalUSDC: bigint;
  numberOfCoins: number;
}

export interface BuyAllResult {
  successful: string[]; // usernames of successful purchases
  failed: Array<{ username: string; error: string }>;
  txHashes: string[];
  totalAttempted: number;
}

/**
 * Get all valid creator coin addresses from profiles
 * Filters out invalid/missing addresses and deduplicates
 */
export function getValidCoins(profiles: Profile[]): Array<{ address: string; username: string; symbol: string }> {
  const seen = new Set<string>();
  const validCoins: Array<{ address: string; username: string; symbol: string }> = [];

  for (const profile of profiles) {
    const address = profile.creator_coin_address;
    
    // Skip if no address or invalid
    if (!address || address === '' || address === '0x0000000000000000000000000000000000000000') {
      continue;
    }

    // Normalize to lowercase for deduplication
    const normalizedAddress = address.toLowerCase();
    
    // Skip duplicates
    if (seen.has(normalizedAddress)) {
      continue;
    }

    seen.add(normalizedAddress);
    validCoins.push({
      address: address, // Use original casing from profile
      username: profile.username,
      symbol: profile.token_ticker || profile.username,
    });
  }

  return validCoins;
}

/**
 * Generate a quote for buying all coins with equal USDC distribution
 */
export function getBuyAllQuote(
  profiles: Profile[],
  totalAmountUSDC: bigint
): BuyAllQuote {
  const validCoins = getValidCoins(profiles);

  if (validCoins.length === 0) {
    throw new Error('No valid creator coins found');
  }

  // Calculate equal amount per coin
  const amountPerCoin = totalAmountUSDC / BigInt(validCoins.length);

  const coins: CoinQuote[] = validCoins.map((coin) => ({
    address: coin.address,
    symbol: coin.symbol,
    amountUSDC: amountPerCoin,
    username: coin.username,
  }));

  return {
    coins,
    totalUSDC: totalAmountUSDC,
    numberOfCoins: validCoins.length,
  };
}

/**
 * Execute buy all transaction - purchases each coin sequentially
 */
export async function executeBuyAll(
  quote: BuyAllQuote,
  walletClient: WalletClient,
  account: Account,
  publicClient: PublicClient,
  slippageMode: SlippageMode,
  customSlippage: number | undefined,
  onProgress: (completed: number, total: number, currentCoin: string) => void
): Promise<BuyAllResult> {
  const successful: string[] = [];
  const failed: Array<{ username: string; error: string }> = [];
  const txHashes: string[] = [];

  for (let i = 0; i < quote.coins.length; i++) {
    const coin = quote.coins[i];
    
    // Update progress
    onProgress(i, quote.coins.length, coin.username);

    try {
      // Execute trade for this coin
      const result: TradeResult = await executeTrade({
        sellAmount: coin.amountUSDC,
        buyToken: coin.address as Address,
        userAddress: account.address,
        slippageMode,
        customSlippage,
        walletClient,
        account,
        publicClient,
      });

      if (result.success && result.txHash) {
        successful.push(coin.username);
        txHashes.push(result.txHash);
        console.log(`[Buy All] Success: ${coin.username} - ${result.txHash}`);
      } else {
        failed.push({
          username: coin.username,
          error: result.error || 'Unknown error',
        });
        console.error(`[Buy All] Failed: ${coin.username} - ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push({
        username: coin.username,
        error: errorMessage,
      });
      console.error(`[Buy All] Exception: ${coin.username}`, error);
    }

    // Small delay between transactions to avoid overwhelming the network
    if (i < quote.coins.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Final progress update
  onProgress(quote.coins.length, quote.coins.length, 'Complete');

  return {
    successful,
    failed,
    txHashes,
    totalAttempted: quote.coins.length,
  };
}
