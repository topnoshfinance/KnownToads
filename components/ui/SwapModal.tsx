'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { base } from 'wagmi/chains';
import { USDC_ADDRESS, SLIPPAGE_TIERS, DEFAULT_SLIPPAGE_MODE, DEFAULT_CUSTOM_SLIPPAGE } from '@/lib/swap-constants';
import { executeTrade, SlippageMode, formatSlippage, getSlippageDisplay } from '@/lib/zora-trade-helpers';
import { fetchTokenInfo } from '@/lib/token-helpers';

// ERC-20 ABI for approve function
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  tokenSymbol?: string;
  chainId: number;
  defaultAmount?: number;
}

type SwapStep = 'input' | 'swapping' | 'success' | 'error';

interface QuoteResult {
  amountOut: bigint;
  exchangeRate: string;
}

export function SwapModal({
  isOpen,
  onClose,
  tokenAddress,
  tokenSymbol = 'TOKEN',
  chainId,
  defaultAmount = 1,
}: SwapModalProps) {
  const [amount, setAmount] = useState<string>(defaultAmount.toString());
  const [step, setStep] = useState<SwapStep>('input');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [slippageMode, setSlippageMode] = useState<SlippageMode>(DEFAULT_SLIPPAGE_MODE);
  const [customSlippage, setCustomSlippage] = useState<number>(DEFAULT_CUSTOM_SLIPPAGE);
  
  // Token info state
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; decimals: number }>({
    symbol: tokenSymbol || 'TOKEN',
    decimals: 18,
  });
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState<boolean>(false);

  const { address: userAddress, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Get account from wallet client
  const account = walletClient?.account;
  
  // Get USDC balance
  const { data: usdcBalanceData } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: base.id,
  });

  const usdcBalance = usdcBalanceData as bigint | undefined;

  // Helper function to get provider display name
  const getProviderDisplay = (): string => {
    return 'Powered by Zora';
  };

  // Helper function to calculate exchange rate
  const calculateExchangeRate = (amountIn: bigint, amountOut: bigint): string => {
    if (amountIn === 0n) return '0';
    const inputAmount = parseFloat(formatUnits(amountIn, 6)); // USDC has 6 decimals
    const outputAmount = parseFloat(formatUnits(amountOut, tokenInfo.decimals));
    
    if (inputAmount === 0) return '0';
    
    const rate = outputAmount / inputAmount;
    
    // Format rate with appropriate precision
    if (rate > 1000) {
      return rate.toFixed(0);
    } else if (rate > 1) {
      return rate.toFixed(2);
    } else if (rate > 0.01) {
      return rate.toFixed(4);
    } else {
      return rate.toExponential(2);
    }
  };

  // Define executeSwap before the useEffects that use it
  const fetchQuote = useCallback(async () => {
    if (!userAddress || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    try {
      setIsLoadingQuote(true);
      setError(null);

      const amountIn = parseUnits(amount, 6); // USDC has 6 decimals
      
      // Note: Zora SDK doesn't provide a separate quote function
      // We'll provide an estimate based on typical outputs
      // The actual amount will be determined during execution with slippage protection
      
      // For now, we'll show a placeholder - actual SDK may have quote endpoint
      // This is a simplified version - in production, you may want to call
      // a quote endpoint if the SDK provides one
      
      const estimatedOut = amountIn * BigInt(1000) / BigInt(1); // Placeholder ratio
      const exchangeRate = calculateExchangeRate(amountIn, estimatedOut);
      
      setQuote({
        amountOut: estimatedOut,
        exchangeRate,
      });
    } catch (err) {
      console.error('Quote error:', err);
      setError('Unable to fetch quote. The token may not be tradeable.');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [userAddress, amount, tokenAddress, tokenInfo.decimals]);

  const executeSwap = useCallback(async () => {
    try {
      if (!userAddress) throw new Error('No wallet connected');
      if (!walletClient) throw new Error('Wallet client not available');
      if (!publicClient) throw new Error('Public client not available');
      if (!account) throw new Error('Account not available');
      
      setError(null);
      setStep('swapping');
      
      const amountIn = parseUnits(amount, 6); // USDC has 6 decimals

      // Get slippage value based on mode (customSlippage is in percentage, needs to be decimal)
      const slippage = slippageMode === 'manual' 
        ? customSlippage / 100 // Convert percentage to decimal
        : undefined; // Let executeTrade use auto mode

      // Execute trade using Zora SDK
      const result = await executeTrade({
        sellAmount: amountIn,
        buyToken: tokenAddress as Address,
        userAddress,
        slippageMode,
        customSlippage,
        walletClient,
        account,
        publicClient,
      });

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        setStep('success');
      } else {
        throw new Error(result.error || 'Trade failed');
      }
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
      setStep('error');
    }
  }, [userAddress, amount, tokenAddress, slippageMode, customSlippage, walletClient, account, publicClient]);

  // Fetch token info when modal opens
  useEffect(() => {
    if (isOpen && tokenAddress) {
      const loadTokenInfo = async () => {
        setIsLoadingTokenInfo(true);
        try {
          const info = await fetchTokenInfo(tokenAddress as Address);
          setTokenInfo(info);
        } catch (err) {
          console.error('Error fetching token info:', err);
          // Keep default values
        } finally {
          setIsLoadingTokenInfo(false);
        }
      };
      loadTokenInfo();
    }
  }, [isOpen, tokenAddress]);

  // Fetch quote when amount changes
  useEffect(() => {
    // Early return if conditions not met
    if (!isConnected || chain?.id !== base.id || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchQuote();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [amount, isConnected, chain?.id, fetchQuote]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setAmount(value);
    }
  };

  const handleSwap = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (chain?.id !== base.id) {
      setError('Please switch to Base network');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amountInWei = parseUnits(amount, 6);
    
    // Check balance
    if (usdcBalance && amountInWei > usdcBalance) {
      setError('Insufficient USDC balance');
      return;
    }

    // Execute swap directly (Zora SDK handles approvals via permit)
    executeSwap();
  };

  const handleClose = () => {
    setStep('input');
    setError(null);
    setTxHash(null);
    setAmount(defaultAmount.toString());
    setQuote(null);
    setIsLoadingQuote(false);
    onClose();
  };

  if (!isOpen) return null;

  const isProcessing = step === 'swapping';

  return (
    <div
      className="swap-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-md)',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          maxWidth: '500px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          border: '2px solid var(--toby-blue)',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h2 style={{ 
            fontSize: 'var(--text-2xl)', 
            fontWeight: 'var(--font-bold)',
            color: 'var(--deep-blue)',
          }}>
            Swap USDC
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--text-2xl)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 'var(--spacing-xs)',
            }}
          >
            ×
          </button>
        </div>

        {/* Success State */}
        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-md)' }}>✅</div>
            <h3 style={{ 
              fontSize: 'var(--text-xl)', 
              fontWeight: 'var(--font-semibold)',
              color: 'var(--deep-blue)',
              marginBottom: 'var(--spacing-md)',
            }}>
              Swap Successful!
            </h3>
            <p style={{ 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--spacing-lg)',
            }}>
              You swapped {amount} USDC for {tokenInfo.symbol}
            </p>
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--toby-blue)',
                  textDecoration: 'underline',
                  fontSize: 'var(--text-sm)',
                }}
              >
                View on Basescan
              </a>
            )}
            <button
              onClick={handleClose}
              className="btn-primary"
              style={{ marginTop: 'var(--spacing-lg)', width: '100%' }}
            >
              Close
            </button>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-md)' }}>❌</div>
            <h3 style={{ 
              fontSize: 'var(--text-xl)', 
              fontWeight: 'var(--font-semibold)',
              color: '#ef4444',
              marginBottom: 'var(--spacing-md)',
            }}>
              Swap Failed
            </h3>
            <p style={{ 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--spacing-lg)',
            }}>
              {error}
            </p>
            <button
              onClick={() => setStep('input')}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Input State */}
        {(step === 'input' || step === 'swapping') && (
          <>
            {/* Wallet Status */}
            {!isConnected && (
              <div style={{
                background: '#fef3c7',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--text-sm)',
                color: '#92400e',
              }}>
                ⚠️ Please connect your Farcaster wallet to swap
              </div>
            )}

            {isConnected && chain?.id !== base.id && (
              <div style={{
                background: '#fee2e2',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--text-sm)',
                color: '#991b1b',
              }}>
                ⚠️ Please switch to Base network
              </div>
            )}

            {/* Amount Input */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--deep-blue)',
                marginBottom: 'var(--spacing-sm)',
              }}>
                Amount (USDC)
              </label>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.0"
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  border: '2px solid var(--toby-blue)',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  background: isProcessing ? 'var(--ice-blue)' : 'var(--white)',
                }}
              />
              {usdcBalance !== undefined && (
                <div style={{ 
                  fontSize: 'var(--text-sm)', 
                  color: 'var(--text-secondary)',
                  marginTop: 'var(--spacing-xs)',
                }}>
                  Balance: {formatUnits(usdcBalance, 6)} USDC
                </div>
              )}
            </div>

            {/* Slippage Mode Toggle */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--deep-blue)',
                marginBottom: 'var(--spacing-sm)',
              }}>
                Slippage Tolerance
              </label>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-sm)',
              }}>
                <button
                  onClick={() => setSlippageMode('auto')}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    border: `2px solid ${slippageMode === 'auto' ? 'var(--toby-blue)' : '#d1d5db'}`,
                    borderRadius: 'var(--radius-md)',
                    background: slippageMode === 'auto' ? 'var(--ice-blue)' : 'var(--white)',
                    color: slippageMode === 'auto' ? 'var(--deep-blue)' : 'var(--text-secondary)',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Auto
                </button>
                <button
                  onClick={() => setSlippageMode('manual')}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-md)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    border: `2px solid ${slippageMode === 'manual' ? 'var(--toby-blue)' : '#d1d5db'}`,
                    borderRadius: 'var(--radius-md)',
                    background: slippageMode === 'manual' ? 'var(--ice-blue)' : 'var(--white)',
                    color: slippageMode === 'manual' ? 'var(--deep-blue)' : 'var(--text-secondary)',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Manual
                </button>
              </div>
              {slippageMode === 'auto' && (
                <div style={{ 
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  marginTop: 'var(--spacing-xs)',
                }}>
                  Progressive: {formatSlippage(SLIPPAGE_TIERS[0])} → {formatSlippage(SLIPPAGE_TIERS[1])} → {formatSlippage(SLIPPAGE_TIERS[2])}
                </div>
              )}
              {slippageMode === 'manual' && (
                <div style={{ marginTop: 'var(--spacing-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <input
                      type="number"
                      value={customSlippage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 50) {
                          setCustomSlippage(value);
                        }
                      }}
                      min="0"
                      max="50"
                      step="0.1"
                      disabled={isProcessing}
                      style={{
                        flex: 1,
                        padding: 'var(--spacing-sm)',
                        fontSize: 'var(--text-sm)',
                        border: '1px solid #d1d5db',
                        borderRadius: 'var(--radius-md)',
                        outline: 'none',
                        background: isProcessing ? 'var(--ice-blue)' : 'var(--white)',
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>%</span>
                  </div>
                  {customSlippage > 10 && (
                    <div style={{ 
                      fontSize: 'var(--text-xs)',
                      color: '#ea580c',
                      marginTop: 'var(--spacing-xs)',
                    }}>
                      ⚠️ High slippage may result in unfavorable trade
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Token Info and Quote */}
            <div style={{
              background: 'var(--ice-blue)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              <div style={{ 
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-xs)',
              }}>
                You will receive
              </div>
              
              {(isLoadingQuote || isLoadingTokenInfo) && (
                <div style={{ 
                  fontSize: 'var(--text-md)',
                  color: 'var(--deep-blue)',
                  fontStyle: 'italic',
                }}>
                  ⏳ {isLoadingTokenInfo ? 'Loading token info...' : 'Fetching price...'}
                </div>
              )}
              
              {!isLoadingQuote && !isLoadingTokenInfo && quote && (
                <>
                  <div style={{ 
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--deep-blue)',
                  }}>
                    ≈ {formatUnits(quote.amountOut, tokenInfo.decimals)} {tokenInfo.symbol}
                  </div>
                  <div style={{ 
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    1 USDC ≈ {quote.exchangeRate} {tokenInfo.symbol}
                  </div>
                  
                  {/* Slippage Display - only show in manual mode */}
                  {slippageMode === 'manual' && (
                    <div style={{ 
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      marginTop: 'var(--spacing-xs)',
                    }}>
                      <span style={{ fontWeight: 'var(--font-semibold)' }}>Slippage:</span> {customSlippage.toFixed(1)}%
                    </div>
                  )}
                </>
              )}
              
              {!isLoadingQuote && !isLoadingTokenInfo && !quote && (
                <div style={{ 
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--deep-blue)',
                }}>
                  {tokenInfo.symbol}
                </div>
              )}
              
              <div style={{ 
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-sm)',
                wordBreak: 'break-all',
              }}>
                {tokenAddress}
              </div>
            </div>

            {/* Processing Status */}
            {step === 'swapping' && (
              <div style={{
                background: '#dbeafe',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--text-sm)',
                color: '#1e40af',
                textAlign: 'center',
              }}>
                ⏳ Swapping... Please confirm in your wallet
              </div>
            )}

            {/* Error Message */}
            {error && step === 'input' && (
              <div style={{
                background: '#fee2e2',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--text-sm)',
                color: '#991b1b',
              }}>
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: 'var(--spacing-md)',
            }}>
              <button
                onClick={handleClose}
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleSwap}
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={isProcessing || !isConnected || isLoadingQuote}
              >
                {isProcessing ? 'Processing...' : isLoadingQuote ? 'Loading...' : 'Swap'}
              </button>
            </div>

            {/* Info Note */}
            <div style={{
              marginTop: 'var(--spacing-md)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}>
              {getProviderDisplay()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
