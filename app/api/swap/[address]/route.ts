import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, Address, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import {
  QUOTER_V2_ADDRESS,
  QUOTER_V2_ABI,
  SWAP_ROUTER_ADDRESS,
  USDC_ADDRESS,
  findPoolAndGetQuote,
  calculateMinimumOutput,
} from '@/lib/uniswap-helpers';

// Uniswap V3 SwapRouter ABI (simplified for exactInputSingle)
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

    // Create a public client to fetch quote
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
    });

    // Amount: 1 USDC (6 decimals)
    const amountIn = parseUnits('1', 6);

    // Get quote to find available pool and expected output
    const quote = await findPoolAndGetQuote(
      USDC_ADDRESS,
      address as Address,
      amountIn,
      publicClient
    );

    if (!quote) {
      return NextResponse.json(
        { 
          error: 'No liquidity pool found for this token pair. This token may not be tradeable on Uniswap V3.',
        },
        { status: 400 }
      );
    }

    // Calculate minimum output with 3% slippage tolerance
    const amountOutMinimum = calculateMinimumOutput(quote.amountOut);

    // Deadline: 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    // Encode the swap transaction
    const calldata = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: USDC_ADDRESS,
          tokenOut: address as Address,
          fee: quote.fee, // Use the fee tier that has liquidity
          recipient: userAddress as Address,
          deadline,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    // Return Farcaster Frame transaction response
    return NextResponse.json({
      chainId: `eip155:${process.env.NEXT_PUBLIC_BASE_CHAIN_ID || '8453'}`,
      method: 'eth_sendTransaction',
      params: {
        abi: SWAP_ROUTER_ABI,
        to: SWAP_ROUTER_ADDRESS,
        data: calldata,
        value: '0',
      },
    });
  } catch (error) {
    console.error('Error creating swap transaction:', error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Failed to create swap transaction';
    
    if (errorMessage.includes('pool') || errorMessage.includes('liquidity')) {
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
