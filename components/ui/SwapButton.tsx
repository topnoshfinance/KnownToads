'use client';

import React, { useState, useRef, useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';
import { 
  SWAP_AMOUNTS, 
  isValidTokenAddress, 
  isValidChainId 
} from '@/lib/swap-constants';

interface SwapButtonProps {
  tokenAddress: string;
  chainId: number;
  tokenSymbol?: string;
  className?: string;
  style?: React.CSSProperties;
  compactMode?: boolean; // If true, shows simple "Buy 1 USDC" without dropdown
}

export function SwapButton({
  tokenAddress,
  chainId,
  tokenSymbol,
  className = '',
  style = {},
  compactMode = false,
}: SwapButtonProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const amounts = [...SWAP_AMOUNTS];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  const handleSwap = async (amount: number) => {
    setLoading(true);
    setError(null);

    try {
      // Validate chain ID
      if (!isValidChainId(chainId)) {
        throw new Error('Only Base chain (8453) is supported');
      }

      // Validate token address format
      if (!isValidTokenAddress(tokenAddress)) {
        throw new Error('Invalid token address format');
      }

      // Call API to get swap URL
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress,
          chainId,
          amountUSD: amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create swap');
      }

      const { swapUrl } = await response.json();

      // Open swap URL using Farcaster Frame SDK
      await sdk.actions.openUrl(swapUrl);
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate swap');
    } finally {
      setLoading(false);
      setShowDropdown(false);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (compactMode) {
      // In compact mode, directly trigger swap with 1 USDC
      handleSwap(1);
    } else {
      // In full mode, toggle dropdown
      setShowDropdown(!showDropdown);
    }
  };

  const handleAmountSelect = (e: React.MouseEvent, amount: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedAmount(amount);
    handleSwap(amount);
  };

  // Compact mode (for directory cards)
  if (compactMode) {
    return (
      <>
        <button
          onClick={handleButtonClick}
          className={`btn-buy-compact ${className}`}
          style={style}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Buy 1 USDC'}
        </button>
        {error && (
          <p style={{ 
            fontSize: 'var(--text-xs)', 
            color: '#ef4444', 
            marginTop: 'var(--spacing-xs)' 
          }}>
            {error}
          </p>
        )}
      </>
    );
  }

  // Full mode with dropdown (for profile page)
  return (
    <div style={{ position: 'relative', ...style }} ref={dropdownRef}>
      <button
        onClick={handleButtonClick}
        className={`btn-primary ${className}`}
        style={{ 
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
        }}
        disabled={loading}
      >
        {loading ? 'Loading...' : `Buy ${selectedAmount} USDC Worth`}
        {!loading && (
          <span style={{ fontSize: 'var(--text-sm)' }}>
            {showDropdown ? '▲' : '▼'}
          </span>
        )}
      </button>

      {showDropdown && !loading && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--spacing-xs)',
            background: 'var(--white)',
            border: '2px solid var(--toby-blue)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {amounts.map((amount) => (
            <button
              key={amount}
              onClick={(e) => handleAmountSelect(e, amount)}
              className="swap-dropdown-option"
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                background: selectedAmount === amount ? 'var(--ice-blue)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--toby-blue)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--deep-blue)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
              }}
            >
              {amount} USDC
              {selectedAmount === amount && (
                <span style={{ float: 'right' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p style={{ 
          fontSize: 'var(--text-sm)', 
          color: '#ef4444', 
          marginTop: 'var(--spacing-sm)' 
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
