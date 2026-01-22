'use client';

import React from 'react';
import sdk from '@farcaster/frame-sdk';
import { Button } from '@/components/ui/Button';

interface ShareButtonProps {
  url: string;
  text?: string;
  variant?: 'primary' | 'secondary';
  style?: React.CSSProperties;
  className?: string;
}

export function ShareButton({ 
  url, 
  text = '🐸 Share', 
  variant = 'secondary',
  style,
  className 
}: ShareButtonProps) {
  const handleShare = async () => {
    try {
      // Use Farcaster Frame SDK to open URL
      await sdk.actions.openUrl(url);
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to native share API if available
      if (navigator.share) {
        try {
          await navigator.share({ url });
        } catch (shareError) {
          console.error('Error with native share:', shareError);
        }
      }
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleShare}
      style={style}
      className={className}
    >
      {text}
    </Button>
  );
}
