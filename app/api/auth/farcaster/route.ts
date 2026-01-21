import { NextRequest, NextResponse } from 'next/server';
import { getFarcasterUser, verifyToadgodFollower } from '@/lib/farcaster';

export async function POST(request: NextRequest) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Verify user follows @toadgod1017
    const isFollower = await verifyToadgodFollower(fid);
    
    if (!isFollower) {
      return NextResponse.json(
        { error: 'You must follow @toadgod1017 to join the toadgang' },
        { status: 403 }
      );
    }

    // Get Farcaster user data
    const user = await getFarcasterUser(fid);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to fetch Farcaster user data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      user 
    });
  } catch (error) {
    console.error('Error in Farcaster auth:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
