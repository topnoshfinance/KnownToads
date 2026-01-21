'use client';

import { useEffect, useState } from 'react';
import sdk from '@farcaster/frame-sdk';

export interface FarcasterContext {
  fid: number | null;
  username: string | null;
  pfpUrl: string | null;
  isConnected: boolean;
}

export function useFarcasterContext(): FarcasterContext {
  const [context, setContext] = useState<FarcasterContext>({
    fid: null,
    username: null,
    pfpUrl: null,
    isConnected: false,
  });

  useEffect(() => {
    const loadContext = async () => {
      try {
        const miniAppContext = await sdk.context;
        
        setContext({
          fid: miniAppContext.user.fid,
          username: miniAppContext.user.username || null,
          pfpUrl: miniAppContext.user.pfpUrl || null,
          isConnected: true,
        });
      } catch (error) {
        console.error('Error loading Farcaster context:', error);
        setContext({
          fid: null,
          username: null,
          pfpUrl: null,
          isConnected: false,
        });
      }
    };

    loadContext();
  }, []);

  return context;
}
