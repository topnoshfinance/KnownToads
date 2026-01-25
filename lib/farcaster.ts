import { FarcasterUser } from '@/types/profile';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';

/**
 * Fetches a Farcaster user by FID using Neynar API
 */
export async function getFarcasterUser(fid: number): Promise<FarcasterUser | null> {
  try {
    const response = await fetch(`${NEYNAR_API_BASE}/user/bulk?fids=${fid}`, {
      headers: {
        'api_key': process.env.NEYNAR_API_KEY || '',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Neynar returns an array of users
    if (!data.users || data.users.length === 0) {
      return null;
    }
    
    const user = data.users[0];
    
    return {
      fid: user.fid,
      username: user.username,
      pfp_url: user.pfp_url || '',
      display_name: user.display_name,
      bio: user.profile?.bio?.text,
    };
  } catch (error) {
    console.error('Error fetching Farcaster user:', error);
    return null;
  }
}

/**
 * Checks if a user follows another user on Farcaster using Neynar API
 */
export async function checkFollowerStatus(
  followerFid: number,
  followedFid: number
): Promise<boolean> {
  try {
    // Use Neynar's user/bulk endpoint with viewer_fid to check if follower follows the target user
    const response = await fetch(
      `${NEYNAR_API_BASE}/user/bulk?fids=${followedFid}&viewer_fid=${followerFid}`,
      {
        headers: {
          'api_key': process.env.NEYNAR_API_KEY || '',
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    
    // Check if the viewer (followerFid) follows the target user (followedFid)
    if (!data.users || data.users.length === 0) {
      return false;
    }
    
    const user = data.users[0];
    return user.viewer_context?.following === true;
  } catch (error) {
    console.error('Error checking follower status:', error);
    return false;
  }
}

/**
 * Verifies that a user follows @toadgod1017
 * @toadgod1017 FID: 482739
 */
export async function verifyToadgodFollower(fid: number): Promise<boolean> {
  // @toadgod1017 FID is 482739
  const toadgodFid = parseInt(process.env.TOADGOD_FID || '482739');
  if (isNaN(toadgodFid)) {
    console.error('TOADGOD_FID not configured or invalid');
    return false;
  }
  
  return await checkFollowerStatus(fid, toadgodFid);
}
