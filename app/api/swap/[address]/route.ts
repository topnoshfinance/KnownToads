import { NextRequest, NextResponse } from 'next/server';
import { parseUnits, Address } from 'viem';
import {
  UNIVERSAL_ROUTER_ADDRESS,
  USDC_ADDRESS,
  getUniversalRouterSwapTransaction,
} from '@/lib/universal-router-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      );
    }

    // Amount: 1 USDC (6 decimals)
    const amountIn = parseUnits('1', 6);

    // Get swap transaction from Universal Router
    const swapTx = await getUniversalRouterSwapTransaction(
      USDC_ADDRESS,
      address as Address,
      amountIn,
      userAddress as Address,
      1000 // 10% slippage
    );

    if (!swapTx) {
      return NextResponse.json(
        { 
          error: 'No liquidity available for this token pair. The token may not be tradeable or may exist only on unsupported DEXs.',
        },
        { status: 400 }
      );
    }

    // Return Farcaster Frame transaction response
    return NextResponse.json({
      chainId: `eip155:${process.env.NEXT_PUBLIC_BASE_CHAIN_ID || '8453'}`,
      method: 'eth_sendTransaction',
      params: {
        to: swapTx.to,
        data: swapTx.data,
        value: swapTx.value,
      },
    });
  } catch (error) {
    console.error('Error creating swap transaction:', error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Failed to create swap transaction';
    
    if (errorMessage.includes('liquidity') || errorMessage.includes('404')) {
      return NextResponse.json(
        { error: 'Insufficient liquidity for this token pair' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create swap transaction. Please try again.' },
      { status: 500 }
    );
  }
}
