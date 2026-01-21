import { NextRequest, NextResponse } from 'next/server';

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SWAP_BASE_URL = 'https://swap.defillama.com/';

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

    if (!amountUSD) {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      );
    }

    // Validate chain ID is Base
    if (chainId !== 8453) {
      return NextResponse.json(
        { error: 'Only Base chain (8453) is supported' },
        { status: 400 }
      );
    }

    // Validate token address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json(
        { error: 'Invalid token address format' },
        { status: 400 }
      );
    }

    // Validate amount is valid
    if (![1, 5, 10].includes(amountUSD)) {
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
