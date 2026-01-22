import { NextRequest, NextResponse } from 'next/server';
import { parseUnits, Address } from 'viem';
import {
  ZEROX_EXCHANGE_PROXY,
  USDC_ADDRESS,
  get0xSwapTransaction,
} from '@/lib/0x-helpers';

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

    // Get swap transaction from 0x API
    const swapTxResult = await get0xSwapTransaction(
      USDC_ADDRESS,
      address as Address,
      amountIn,
      userAddress as Address
    );

    if (!swapTxResult) {
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
        to: swapTxResult.quote.to,
        data: swapTxResult.quote.data,
        value: swapTxResult.quote.value,
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
