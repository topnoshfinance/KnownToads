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
      
      // Log SDK capabilities for debugging
      console.log('Farcaster Frame SDK initialized');
      console.log('Available SDK methods:', {
        actions: Object.keys(sdk.actions || {}),
        wallet: sdk.wallet ? 'available' : 'unavailable',
      });
    };
    
    init();
  }, []);

  return <>{children}</>;
}
