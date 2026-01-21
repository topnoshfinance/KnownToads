import { NextRequest, NextResponse } from 'next/server';
import { validateERC20Contract } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const result = await validateERC20Contract(address);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating contract:', error);
    return NextResponse.json(
      { error: 'Failed to validate contract' },
      { status: 500 }
    );
  }
}
