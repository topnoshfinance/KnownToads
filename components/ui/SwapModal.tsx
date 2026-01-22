'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { base } from 'wagmi/chains';
import {
  ZEROX_EXCHANGE_PROXY,
  USDC_ADDRESS,
  get0xQuote,
  get0xSwapTransaction,
  formatExchangeRate,
  QuoteResult,
} from '@/lib/0x-helpers';

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

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, ZEROX_EXCHANGE_PROXY] : undefined,
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
      
      const quoteResult = await get0xQuote(
        USDC_ADDRESS,
        tokenAddress as Address,
        amountIn,
        userAddress
      );

      if (!quoteResult) {
        setError('No liquidity available for this token. The token may not be tradeable or may exist only on unsupported DEXs.');
        setQuote(null);
        setSwapTxData(null);
      } else {
        setQuote(quoteResult);
        // Note: We'll fetch the full transaction data when executing the swap
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
        args: [ZEROX_EXCHANGE_PROXY, amountInWei],
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

      // Get swap transaction from 0x API
      const swapTx = await get0xSwapTransaction(
        USDC_ADDRESS,
        tokenAddress as Address,
        amountIn,
        userAddress
      );

      if (!swapTx) {
        throw new Error('Failed to get swap transaction from 0x API');
      }

      // Send the transaction using the data from 0x
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
        zIndex: 9999,
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
              You swapped {amount} USDC for {tokenSymbol}
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
              
              {isLoadingQuote && (
                <div style={{ 
                  fontSize: 'var(--text-md)',
                  color: 'var(--deep-blue)',
                  fontStyle: 'italic',
                }}>
                  ⏳ Fetching price...
                </div>
              )}
              
              {!isLoadingQuote && quote && (
                <>
                  <div style={{ 
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--deep-blue)',
                  }}>
                    ≈ {formatUnits(quote.amountOut, 18)} {tokenSymbol}
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
                      tokenSymbol
                    )}
                  </div>
                  <div style={{ 
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    Slippage: 3%
                  </div>
                </>
              )}
              
              {!isLoadingQuote && !quote && (
                <div style={{ 
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--deep-blue)',
                }}>
                  {tokenSymbol}
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
              Swaps powered by 0x Protocol
            </div>
          </>
        )}
      </div>
    </div>
  );
}
