import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, parseUnits, Address } from 'viem';

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

// Base Uniswap V3 SwapRouter address
const SWAP_ROUTER_ADDRESS = '0x2626664c2603336E57B271c5C0b26F421741e481' as Address;
// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;

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
          fee: 3000, // 0.3% fee tier
          recipient: userAddress as Address,
          deadline,
          amountIn,
          amountOutMinimum: 0n, // Accept any amount (in production, calculate slippage)
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
    return NextResponse.json(
      { error: 'Failed to create swap transaction' },
      { status: 500 }
    );
  }
}
