'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { base } from 'wagmi/chains';
import {
  UNIVERSAL_ROUTER_ADDRESS,
  USDC_ADDRESS,
  getUniversalRouterQuote,
  getUniversalRouterSwapTransaction,
  formatExchangeRate,
} from '@/lib/universal-router-helpers';
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

type SwapStep = 'input' | 'approving' | 'swapping' | 'success' | 'error';

interface QuoteResult {
  amountOut: bigint;
  amountOutMinimum: bigint;
  slippageBps: number;
  highSlippageWarning?: boolean;
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
  const [swapTxData, setSwapTxData] = useState<{ to: string; data: string; value: string } | null>(null);
  const [showSlippageWarning, setShowSlippageWarning] = useState<boolean>(false);
  
  // Token info state
  const [tokenInfo, setTokenInfo] = useState<{ symbol: string; decimals: number }>({
    symbol: tokenSymbol || 'TOKEN',
    decimals: 18,
  });
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState<boolean>(false);

  const { address: userAddress, isConnected, chain } = useAccount();
  
  // Get USDC balance
  const { data: usdcBalanceData } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: base.id,
  });

  const usdcBalance = usdcBalanceData as bigint | undefined;

  // Check USDC allowance for Universal Router
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, UNIVERSAL_ROUTER_ADDRESS] : undefined,
    chainId: base.id,
  });

  // Approve hook
  const { 
    writeContract: approve,
    data: approveData,
    isPending: isApprovePending,
  } = useWriteContract();

  // Wait for approve tx
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveData,
    chainId: base.id,
  });

  // Swap hook
  const {
    sendTransaction: sendSwapTx,
    data: swapData,
    isPending: isSwapPending,
  } = useSendTransaction();

  // Wait for swap tx
  const { isSuccess: isSwapSuccess } = useWaitForTransactionReceipt({
    hash: swapData,
    chainId: base.id,
  });

  // Helper function to get provider display name
  const getProviderDisplay = (): string => {
    return 'Uniswap Universal Router';
  };

  // Helper function to get slippage display
  const getSlippageDisplay = (): string | null => {
    if (!quote?.slippageBps) return null;
    const percentage = (quote.slippageBps / 100).toFixed(1);
    return `${percentage}%`;
  };

  // Define executeSwap and executeApprove before the useEffects that use them
  const fetchQuote = useCallback(async () => {
    if (!userAddress || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      setSwapTxData(null);
      return;
    }

    try {
      setIsLoadingQuote(true);
      setError(null);

      const amountIn = parseUnits(amount, 6); // USDC has 6 decimals
      const slippageBps = 1000; // 10% default
      
      // Get quote from Universal Router
      const quoteResult = await getUniversalRouterQuote(
        USDC_ADDRESS,
        tokenAddress as Address,
        amountIn,
        slippageBps
      );

      if (!quoteResult) {
        setError('No liquidity available for this token. The token may not be tradeable or may exist only on unsupported DEXs.');
        setQuote(null);
        setSwapTxData(null);
        setShowSlippageWarning(false);
      } else {
        const highSlippageWarning = slippageBps >= 1000;
        setQuote({
          amountOut: quoteResult.estimatedOut,
          amountOutMinimum: quoteResult.amountOutMinimum,
          slippageBps,
          highSlippageWarning,
        });
        // Show high slippage warning if >= 10%
        setShowSlippageWarning(highSlippageWarning);
        setSwapTxData(null);
      }
    } catch (err) {
      console.error('Quote error:', err);
      setError('Failed to fetch price quote. Please try again.');
      setQuote(null);
      setSwapTxData(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [userAddress, amount, tokenAddress]);

  const executeApprove = useCallback(async () => {
    try {
      setError(null);
      setStep('approving');
      
      const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
      
      approve({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [UNIVERSAL_ROUTER_ADDRESS, amountInWei],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Approve error:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve');
      setStep('error');
    }
  }, [amount, approve]);

  const executeSwap = useCallback(async () => {
    try {
      if (!userAddress) throw new Error('No wallet connected');
      if (!quote) throw new Error('No price quote available');
      
      setError(null);
      setStep('swapping');
      
      const amountIn = parseUnits(amount, 6); // USDC has 6 decimals

      // Get swap transaction from Universal Router
      const swapTx = await getUniversalRouterSwapTransaction(
        USDC_ADDRESS,
        tokenAddress as Address,
        amountIn,
        userAddress,
        quote.slippageBps
      );

      if (!swapTx) {
        throw new Error('Failed to get swap transaction. No liquidity available.');
      }

      // Send the transaction
      sendSwapTx({
        to: swapTx.to as Address,
        data: swapTx.data as `0x${string}`,
        value: BigInt(swapTx.value),
        chainId: base.id,
      });
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
      setStep('error');
    }
  }, [userAddress, amount, tokenAddress, quote, sendSwapTx]);

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

  // Handle approve success
  useEffect(() => {
    if (isApproveSuccess) {
      const proceedWithSwap = async () => {
        await refetchAllowance();
        executeSwap();
      };
      proceedWithSwap();
    }
  }, [isApproveSuccess, refetchAllowance, executeSwap]);

  // Handle swap success
  useEffect(() => {
    if (isSwapSuccess && swapData) {
      setTxHash(swapData);
      setStep('success');
    }
  }, [isSwapSuccess, swapData]);

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

    if (!quote) {
      setError('No price quote available. The pool may not exist or has insufficient liquidity.');
      return;
    }

    const amountInWei = parseUnits(amount, 6);
    
    // Check balance
    if (usdcBalance && amountInWei > usdcBalance) {
      setError('Insufficient USDC balance');
      return;
    }

    // Check if approval needed
    if (!allowance || allowance < amountInWei) {
      executeApprove();
    } else {
      executeSwap();
    }
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

  const isProcessing = step === 'approving' || step === 'swapping';

  return (
    <div
      className="swap-modal-overlay"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-md)',
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
          position: 'relative',
          zIndex: 100000,
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
        {(step === 'input' || step === 'approving' || step === 'swapping') && (
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
                    {formatExchangeRate(
                      parseUnits(amount || '0', 6),
                      quote.amountOut,
                      'USDC',
                      tokenInfo.symbol,
                      6,
                      tokenInfo.decimals
                    )}
                  </div>
                  
                  {/* Provider Display */}
                  <div style={{ 
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    <span style={{ fontWeight: 'var(--font-semibold)' }}>Provider:</span> {getProviderDisplay()}
                  </div>
                  
                  {/* Slippage Display */}
                  {quote.slippageBps && (
                    <div style={{ 
                      fontSize: 'var(--text-xs)',
                      color: quote.highSlippageWarning ? '#ea580c' : 'var(--text-secondary)',
                      marginTop: 'var(--spacing-xs)',
                      fontWeight: quote.highSlippageWarning ? 'var(--font-semibold)' : 'normal',
                    }}>
                      <span style={{ fontWeight: 'var(--font-semibold)' }}>Slippage:</span> {getSlippageDisplay()}
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

            {/* High Slippage Warning */}
            {showSlippageWarning && (
              <div style={{
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: '#fff7ed',
                border: '1px solid #fb923c',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--spacing-sm)',
                }}>
                  <span style={{ fontSize: '20px', lineHeight: '1' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-semibold)',
                      color: '#9a3412',
                      marginBottom: 'var(--spacing-xs)',
                      marginTop: 0,
                    }}>
                      High Slippage Warning
                    </h4>
                    <p style={{
                      fontSize: 'var(--text-xs)',
                      color: '#9a3412',
                      margin: 0,
                      lineHeight: '1.4',
                    }}>
                      This swap requires {getSlippageDisplay()} slippage due to low liquidity. Your trade may execute at a significantly different price. Consider using a smaller amount or waiting for more liquidity.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Status */}
            {step === 'approving' && (
              <div style={{
                background: '#dbeafe',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--text-sm)',
                color: '#1e40af',
                textAlign: 'center',
              }}>
                ⏳ Approving USDC... Please confirm in your wallet
              </div>
            )}

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
                disabled={isProcessing || !isConnected || isLoadingQuote || !quote}
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
              Swaps powered by {getProviderDisplay()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
