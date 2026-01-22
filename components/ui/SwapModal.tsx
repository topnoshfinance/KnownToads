'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, Address, encodeFunctionData } from 'viem';
import { base } from 'wagmi/chains';

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

// Uniswap V3 SwapRouter ABI
const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

// Uniswap V3 Router address on Base
const SWAP_ROUTER_ADDRESS = '0x2626664c2603336E57B271c5C0b26F421741e481' as Address;
// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

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
    args: userAddress ? [userAddress, SWAP_ROUTER_ADDRESS] : undefined,
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
    writeContract: swap,
    data: swapData,
    isPending: isSwapPending,
  } = useWriteContract();

  // Wait for swap tx
  const { isSuccess: isSwapSuccess } = useWaitForTransactionReceipt({
    hash: swapData,
    chainId: base.id,
  });

  // Define executeSwap and executeApprove before the useEffects that use them
  const executeApprove = useCallback(async () => {
    try {
      setError(null);
      setStep('approving');
      
      const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals
      
      approve({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_ROUTER_ADDRESS, amountInWei],
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
      
      setError(null);
      setStep('swapping');
      
      const amountIn = parseUnits(amount, 6); // USDC has 6 decimals
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      // Calculate minimum output with 0.5% slippage tolerance
      // Note: In production, this should fetch actual price and calculate proper slippage
      const slippageTolerance = 50n; // 0.5% in basis points (50/10000)
      const amountOutMinimum = 0n; // Simplified - in production, calculate based on price quote

      swap({
        address: SWAP_ROUTER_ADDRESS,
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: USDC_ADDRESS,
            tokenOut: tokenAddress as Address,
            fee: 3000, // 0.3% fee tier
            recipient: userAddress,
            deadline,
            amountIn,
            amountOutMinimum,
            sqrtPriceLimitX96: 0n,
          },
        ],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
      setStep('error');
    }
  }, [userAddress, amount, tokenAddress, swap]);

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

            {/* Token Info */}
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
              <div style={{ 
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--deep-blue)',
              }}>
                {tokenSymbol}
              </div>
              <div style={{ 
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-xs)',
                wordBreak: 'break-all',
              }}>
                {tokenAddress}
              </div>
              <div style={{ 
                fontSize: 'var(--text-xs)',
                color: '#d97706',
                marginTop: 'var(--spacing-sm)',
                fontStyle: 'italic',
              }}>
                ⚠️ Note: Slippage protection is minimal. Review transaction carefully.
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
                disabled={isProcessing || !isConnected}
              >
                {isProcessing ? 'Processing...' : 'Swap'}
              </button>
            </div>

            {/* Info Note */}
            <div style={{
              marginTop: 'var(--spacing-md)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}>
              Swaps are executed via Uniswap V3 on Base
            </div>
          </>
        )}
      </div>
    </div>
  );
}
