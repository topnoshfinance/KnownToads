'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useWalletClient, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { base } from 'wagmi/chains';
import { Profile } from '@/types/profile';
import { USDC_ADDRESS, SLIPPAGE_TIERS, DEFAULT_SLIPPAGE_MODE, DEFAULT_CUSTOM_SLIPPAGE } from '@/lib/swap-constants';
import { SlippageMode, formatSlippage } from '@/lib/zora-trade-helpers';
import { getBuyAllQuote, executeBuyAll, BuyAllQuote, BuyAllResult } from '@/lib/buy-all-helpers';

// ERC-20 ABI for balance check
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface BuyAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
}

type BuyAllStep = 'input' | 'buying' | 'success' | 'error';

const MIN_AMOUNT = 5; // Minimum $5 USDC

export function BuyAllModal({ isOpen, onClose, profiles }: BuyAllModalProps) {
  const [amount, setAmount] = useState<string>(MIN_AMOUNT.toString());
  const [step, setStep] = useState<BuyAllStep>('input');
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<BuyAllQuote | null>(null);
  const [result, setResult] = useState<BuyAllResult | null>(null);
  const [slippageMode, setSlippageMode] = useState<SlippageMode>(DEFAULT_SLIPPAGE_MODE);
  const [customSlippage, setCustomSlippage] = useState<number>(DEFAULT_CUSTOM_SLIPPAGE);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; current: string }>({
    completed: 0,
    total: 0,
    current: '',
  });

  const { address: userAddress, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
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

  // Set mounted state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate quote when amount or profiles change
  useEffect(() => {
    if (!amount || parseFloat(amount) < MIN_AMOUNT) {
      setQuote(null);
      return;
    }

    try {
      const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
      const newQuote = getBuyAllQuote(profiles, amountInWei);
      setQuote(newQuote);
    } catch (err) {
      console.error('Quote error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate quote');
      setQuote(null);
    }
  }, [amount, profiles]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setAmount(value);
      setError(null);
    }
  };

  const handleBuyAll = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (chain?.id !== base.id) {
      setError('Please switch to Base network');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!amount || numAmount < MIN_AMOUNT) {
      setError(`Minimum amount is $${MIN_AMOUNT} USDC`);
      return;
    }

    if (!quote) {
      setError('Unable to generate quote');
      return;
    }

    const amountInWei = parseUnits(amount, 6);

    // Check balance
    if (usdcBalance && amountInWei > usdcBalance) {
      setError('Insufficient USDC balance');
      return;
    }

    if (!walletClient || !account || !publicClient) {
      setError('Wallet not properly connected');
      return;
    }

    try {
      setError(null);
      setStep('buying');
      setProgress({ completed: 0, total: quote.numberOfCoins, current: '' });

      const buyResult = await executeBuyAll(
        quote,
        walletClient,
        account,
        publicClient,
        slippageMode,
        customSlippage,
        (completed, total, current) => {
          setProgress({ completed, total, current });
        }
      );

      setResult(buyResult);
      
      if (buyResult.successful.length > 0) {
        setStep('success');
      } else {
        setError('All purchases failed');
        setStep('error');
      }
    } catch (err) {
      console.error('Buy all error:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute purchases');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('input');
    setError(null);
    setQuote(null);
    setResult(null);
    setAmount(MIN_AMOUNT.toString());
    setProgress({ completed: 0, total: 0, current: '' });
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const isProcessing = step === 'buying';
  const amountPerCoin = quote ? formatUnits(quote.totalUSDC / BigInt(quote.numberOfCoins), 6) : '0';

  const modalContent = (
    <div
      className="buy-all-modal-overlay"
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
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--deep-blue)',
            }}
          >
            🐸 Buy All Coins
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
        {step === 'success' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: 'var(--spacing-md)' }}>
              {result.successful.length === result.totalAttempted ? '✅' : '⚠️'}
            </div>
            <h3
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--deep-blue)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              Purchase Complete!
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-lg)',
              }}
            >
              Successfully purchased {result.successful.length} of {result.totalAttempted} coins
            </p>

            {/* Successful purchases */}
            {result.successful.length > 0 && (
              <div
                style={{
                  background: '#d1fae5',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-md)',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    color: '#065f46',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  ✓ Successful ({result.successful.length})
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: '#047857',
                    maxHeight: '100px',
                    overflowY: 'auto',
                  }}
                >
                  {result.successful.join(', ')}
                </div>
              </div>
            )}

            {/* Failed purchases */}
            {result.failed.length > 0 && (
              <div
                style={{
                  background: '#fee2e2',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-md)',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    color: '#991b1b',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  ✗ Failed ({result.failed.length})
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: '#991b1b',
                    maxHeight: '150px',
                    overflowY: 'auto',
                  }}
                >
                  {result.failed.map((f, i) => (
                    <div key={i} style={{ marginBottom: 'var(--spacing-xs)' }}>
                      <strong>{f.username}</strong>: {f.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction hashes */}
            {result.txHashes.length > 0 && (
              <div
                style={{
                  marginTop: 'var(--spacing-md)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                  {result.txHashes.length} transaction{result.txHashes.length !== 1 ? 's' : ''}{' '}
                  completed
                </div>
                <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {result.txHashes.map((hash, i) => (
                    <a
                      key={i}
                      href={`https://basescan.org/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--toby-blue)',
                        textDecoration: 'underline',
                        display: 'block',
                      }}
                    >
                      View transaction {i + 1}
                    </a>
                  ))}
                </div>
              </div>
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
            <h3
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-semibold)',
                color: '#ef4444',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              Purchase Failed
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-lg)',
              }}
            >
              {error}
            </p>
            {result && result.failed.length > 0 && (
              <div
                style={{
                  background: '#fee2e2',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-md)',
                  textAlign: 'left',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    color: '#991b1b',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Failed purchases:
                </div>
                {result.failed.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: '#991b1b',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    <strong>{f.username}</strong>: {f.error}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep('input')} className="btn-primary" style={{ width: '100%' }}>
              Try Again
            </button>
          </div>
        )}

        {/* Input & Buying States */}
        {(step === 'input' || step === 'buying') && (
          <>
            {/* Wallet Status Warnings */}
            {!isConnected && (
              <div
                style={{
                  background: '#fef3c7',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-lg)',
                  fontSize: 'var(--text-sm)',
                  color: '#92400e',
                }}
              >
                ⚠️ Please connect your Farcaster wallet to buy
              </div>
            )}

            {isConnected && chain?.id !== base.id && (
              <div
                style={{
                  background: '#fee2e2',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-lg)',
                  fontSize: 'var(--text-sm)',
                  color: '#991b1b',
                }}
              >
                ⚠️ Please switch to Base network
              </div>
            )}

            {/* Description */}
            <div
              style={{
                background: 'var(--ice-blue)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-lg)',
                fontSize: 'var(--text-sm)',
                color: 'var(--deep-blue)',
              }}
            >
              <p style={{ marginBottom: 'var(--spacing-xs)' }}>
                <strong>Buy equal shares of all creator coins in the directory!</strong>
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                This will execute multiple transactions (one per coin). Each purchase happens
                sequentially with progress tracking.
              </p>
            </div>

            {/* Amount Input */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--deep-blue)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                Total Amount (USDC)
              </label>
              <input
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder={`Min: ${MIN_AMOUNT}`}
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
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--spacing-xs)',
                  }}
                >
                  Balance: {formatUnits(usdcBalance, 6)} USDC
                </div>
              )}
            </div>

            {/* Quote Display */}
            {quote && (
              <div
                style={{
                  background: 'var(--ice-blue)',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-lg)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Number of coins:
                  </span>
                  <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--deep-blue)' }}>
                    {quote.numberOfCoins}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Per coin:
                  </span>
                  <span style={{ fontWeight: 'var(--font-semibold)', color: 'var(--deep-blue)' }}>
                    ${amountPerCoin} USDC
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Total:
                  </span>
                  <span
                    style={{
                      fontWeight: 'var(--font-bold)',
                      fontSize: 'var(--text-lg)',
                      color: 'var(--deep-blue)',
                    }}
                  >
                    ${formatUnits(quote.totalUSDC, 6)} USDC
                  </span>
                </div>
              </div>
            )}

            {/* Slippage Settings */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--deep-blue)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                Slippage Tolerance
              </label>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
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
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--spacing-xs)',
                  }}
                >
                  Progressive: {formatSlippage(SLIPPAGE_TIERS[0])} →{' '}
                  {formatSlippage(SLIPPAGE_TIERS[1])} → {formatSlippage(SLIPPAGE_TIERS[2])}
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
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Coin List */}
            {quote && quote.coins.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    color: 'var(--deep-blue)',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  Coins to purchase ({quote.numberOfCoins}):
                </div>
                <div
                  style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    background: 'var(--white)',
                    border: '1px solid #d1d5db',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-sm)',
                  }}
                >
                  {quote.coins.map((coin, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-secondary)',
                        padding: 'var(--spacing-xs) 0',
                        borderBottom:
                          i < quote.coins.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}
                    >
                      {coin.username} ({coin.symbol})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Display */}
            {step === 'buying' && (
              <div
                style={{
                  background: '#dbeafe',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-lg)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: '#1e40af',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  ⏳ Purchasing coins... {progress.completed} of {progress.total}
                </div>
                {progress.current && (
                  <div style={{ fontSize: 'var(--text-xs)', color: '#1e40af' }}>
                    Current: {progress.current}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    height: '4px',
                    background: '#e5e7eb',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--toby-blue)',
                      width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                      transition: 'width var(--transition-fast)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && step === 'input' && (
              <div
                style={{
                  background: '#fee2e2',
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-lg)',
                  fontSize: 'var(--text-sm)',
                  color: '#991b1b',
                }}
              >
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <button
                onClick={handleClose}
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleBuyAll}
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={isProcessing || !isConnected || !quote || parseFloat(amount) < MIN_AMOUNT}
              >
                {isProcessing ? 'Processing...' : 'Buy All'}
              </button>
            </div>

            {/* Info Note */}
            <div
              style={{
                marginTop: 'var(--spacing-md)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                textAlign: 'center',
              }}
            >
              Powered by Zora • Multiple transactions will be executed
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}
