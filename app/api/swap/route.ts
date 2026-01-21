import { NextRequest, NextResponse } from 'next/server';
import {
  USDC_ADDRESS,
  SWAP_BASE_URL,
  isValidTokenAddress,
  isValidChainId,
  isValidSwapAmount,
} from '@/lib/swap-constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenAddress, chainId, amountUSD } = body;

    // Validate required fields
    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    if (typeof amountUSD === 'undefined' || amountUSD === null) {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      );
    }

    // Validate chain ID is Base
    if (!isValidChainId(chainId)) {
      return NextResponse.json(
        { error: 'Only Base chain (8453) is supported' },
        { status: 400 }
      );
    }

    // Validate token address format
    if (!isValidTokenAddress(tokenAddress)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      );
    }

    // Validate amount is valid
    if (!isValidSwapAmount(amountUSD)) {
      return NextResponse.json(
        { error: 'Amount must be 1, 5, or 10 USDC' },
        { status: 400 }
      );
    }

    // Generate DefiLlama swap URL
    const swapUrl = `${SWAP_BASE_URL}?chain=base&from=${USDC_ADDRESS}&to=${tokenAddress}&amount=${amountUSD}`;

    return NextResponse.json({
      swapUrl,
      tokenAddress,
      chainId,
      amountUSD,
    });
  } catch (error) {
    console.error('Error creating swap URL:', error);
    return NextResponse.json(
      { error: 'Failed to create swap URL' },
      { status: 500 }
    );
  }
}
