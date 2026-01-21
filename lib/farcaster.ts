import { FarcasterUser } from '@/types/profile';

const FARCASTER_API_BASE = 'https://api.warpcast.com/v2';

/**
 * Fetches a Farcaster user by FID
 */
export async function getFarcasterUser(fid: number): Promise<FarcasterUser | null> {
  try {
    const response = await fetch(`${FARCASTER_API_BASE}/user?fid=${fid}`, {
      headers: {
        'Authorization': `Bearer ${process.env.FARCASTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    return {
      fid: data.result.user.fid,
      username: data.result.user.username,
      pfp_url: data.result.user.pfp?.url || '',
      display_name: data.result.user.displayName,
      bio: data.result.user.profile?.bio?.text,
    };
  } catch (error) {
    console.error('Error fetching Farcaster user:', error);
    return null;
  }
}

/**
 * Checks if a user follows another user on Farcaster
 */
export async function checkFollowerStatus(
  followerFid: number,
  followedFid: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `${FARCASTER_API_BASE}/following?fid=${followerFid}&target_fid=${followedFid}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FARCASTER_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.result.following === true;
  } catch (error) {
    console.error('Error checking follower status:', error);
    return false;
  }
}

/**
 * Verifies that a user follows @toadgod1017
 */
export async function verifyToadgodFollower(fid: number): Promise<boolean> {
  const toadgodFid = parseInt(process.env.TOADGOD_FID || '0');
  if (!toadgodFid) {
    console.error('TOADGOD_FID not configured');
    return false;
  }
  
  return await checkFollowerStatus(fid, toadgodFid);
}
