import { NextRequest, NextResponse } from 'next/server';

const ZORA_API_BASE_URL = 'https://api-sdk.zora.engineering';
const BASE_CHAIN_ID = 8453;
const ZORA_QUOTE_SLIPPAGE = 0.05;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sellToken, buyToken, sellAmount, takerAddress } = body;

    // Validate required parameters
    if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: sellToken, buyToken, sellAmount, takerAddress' },
        { status: 400 }
      );
    }

    // Validate sellAmount is a valid numeric string
    if (isNaN(Number(sellAmount)) || Number(sellAmount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid sellAmount: must be a positive number' },
        { status: 400 }
      );
    }

    // Build request body matching Zora API schema
    const requestBody = {
      tokenIn: {
        type: "erc20",
        address: sellToken,
      },
      tokenOut: {
        type: "erc20",
        address: buyToken,
      },
      amountIn: sellAmount.toString(),
      chainId: BASE_CHAIN_ID,
      sender: takerAddress,
      recipient: takerAddress,
      slippage: ZORA_QUOTE_SLIPPAGE,
    };

    // Server-side: ZORA_API_KEY is available here
    const apiKey = process.env.ZORA_API_KEY;
    
    if (!apiKey) {
      console.error('[Quote API] ZORA_API_KEY not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: API key not configured' },
        { status: 500 }
      );
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    };

    console.log('[Quote API] Fetching quote from Zora:', {
      sellToken,
      buyToken,
      sellAmount,
      hasApiKey: !!apiKey,
    });

    const response = await fetch(`${ZORA_API_BASE_URL}/quote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('[Quote API] Zora response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Quote API] Zora API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      // Return null-like response for no liquidity cases
      if (response.status === 404 || response.status === 400) {
        return NextResponse.json({ quote: null });
      }
      
      return NextResponse.json(
        { error: `Zora API error: ${response.status}` },
        { status: response.status }
      );
    }

    const quote = await response.json();
    
    console.log('[Quote API] Quote successful:', {
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount,
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
