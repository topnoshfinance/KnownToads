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
      // Build Warpcast compose URL with text and embedded frame
      const shareText = encodeURIComponent(text);
      const embedUrl = encodeURIComponent(url);
      const warpcastComposeUrl = `https://warpcast.com/~/compose?text=${shareText}&embeds[]=${embedUrl}`;
      
      // Try to use SDK openUrl for in-app experience
      if (sdk?.actions?.openUrl) {
        try {
          await sdk.actions.openUrl(warpcastComposeUrl);
          return;
        } catch (sdkError) {
          console.warn('SDK openUrl not available, falling back to window.open:', sdkError);
        }
      }
      
      // Fallback to window.open for web browsers
      if (typeof window !== 'undefined') {
        const opened = window.open(warpcastComposeUrl, '_blank', 'noopener,noreferrer');
        if (opened) {
          return;
        }
      }
      
      // Last resort: copy to clipboard
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          alert('Link copied to clipboard!');
        } catch (clipboardError) {
          console.error('Error copying to clipboard:', clipboardError);
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
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
