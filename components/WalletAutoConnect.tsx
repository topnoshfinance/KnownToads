'use client';

import { useEffect } from 'react';
import { useConnect } from 'wagmi';

/**
 * Component to automatically connect to Farcaster wallet when in Frame context
 */
export function WalletAutoConnect() {
  const { connect, connectors } = useConnect();

  useEffect(() => {
    // Auto-connect when the component mounts if we're in a Farcaster Frame
    const farcasterConnector = connectors.find(
      (connector) => connector.id === 'farcaster'
    );
    
    if (farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  }, [connect, connectors]);

  return null;
}
