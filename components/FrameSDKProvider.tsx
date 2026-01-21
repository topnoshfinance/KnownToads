'use client';

import { useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';

export function FrameSDKProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Signal to Farcaster that the app is ready
    const init = async () => {
      await sdk.actions.ready();
      
      // Enable web navigation for back button support
      sdk.back.enableWebNavigation();
    };
    
    init();
  }, []);

  return <>{children}</>;
}
