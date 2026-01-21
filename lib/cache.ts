import { supabase } from './supabase';
import { getFarcasterUser } from './farcaster';

const PFP_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Checks if PFP cache is stale (older than 24 hours)
 */
export function isPfpCacheStale(cachedAt: string): boolean {
  const cacheTime = new Date(cachedAt).getTime();
  const now = Date.now();
  return now - cacheTime > PFP_CACHE_DURATION_MS;
}

/**
 * Gets PFP URL from cache or fetches fresh from Farcaster API
 */
export async function getCachedPfp(fid: number): Promise<string | null> {
  try {
    // Check database cache first
    const { data: profile } = await supabase
      .from('profiles')
      .select('pfp_url, pfp_cached_at')
      .eq('fid', fid)
      .single();

    // If cached and fresh, return cached URL
    if (profile && !isPfpCacheStale(profile.pfp_cached_at)) {
      return profile.pfp_url;
    }

    // Fetch fresh PFP from Farcaster API
    const farcasterUser = await getFarcasterUser(fid);
    if (!farcasterUser) {
      return null;
    }

    // Update cache in database if profile exists
    if (profile) {
      await supabase
        .from('profiles')
        .update({
          pfp_url: farcasterUser.pfp_url,
          pfp_cached_at: new Date().toISOString(),
        })
        .eq('fid', fid);
    }

    return farcasterUser.pfp_url;
  } catch (error) {
    console.error('Error getting cached PFP:', error);
    return null;
  }
}

/**
 * Refreshes PFP for a profile if cache is stale
 */
export async function refreshPfpIfNeeded(fid: number): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('pfp_cached_at')
      .eq('fid', fid)
      .single();

    if (!profile || !isPfpCacheStale(profile.pfp_cached_at)) {
      return; // Cache is fresh, no need to refresh
    }

    const farcasterUser = await getFarcasterUser(fid);
    if (farcasterUser) {
      await supabase
        .from('profiles')
        .update({
          pfp_url: farcasterUser.pfp_url,
          pfp_cached_at: new Date().toISOString(),
        })
        .eq('fid', fid);
    }
  } catch (error) {
    console.error('Error refreshing PFP:', error);
  }
}
