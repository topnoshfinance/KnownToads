/**
 * @deprecated This API route is no longer used.
 * The application now uses Zora Coins SDK client-side for all swaps.
 * This file is kept for backward compatibility but should not be used.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  return NextResponse.json(
    { error: 'This API endpoint is deprecated. Please use the Zora SDK client-side integration.' },
    { status: 410 } // 410 Gone
  );
}
