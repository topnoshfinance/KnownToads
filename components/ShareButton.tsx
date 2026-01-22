'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface ShareButtonProps {
  url: string;
  text?: string;
  variant?: 'primary' | 'secondary';
  style?: React.CSSProperties;
  className?: string;
}

// Type definition for Farcaster window interface
interface FarcasterWindow extends Window {
  farcaster?: {
    share: (data: { url: string; text: string }) => void;
  };
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
      // Use Farcaster's native share API as required by the platform
      const farcasterWindow = typeof window !== 'undefined' ? (window as FarcasterWindow) : null;
      
      if (farcasterWindow?.farcaster?.share) {
        farcasterWindow.farcaster.share({
          url: url,
          text: text
        });
      } else {
        console.warn('Farcaster share API not available');
        // Fallback to native share API if available
        if (navigator.share) {
          try {
            await navigator.share({ 
              url,
              text 
            });
          } catch (shareError) {
            console.error('Error with native share:', shareError);
          }
        } else if (navigator.clipboard) {
          // Last resort: copy to clipboard with proper error handling
          try {
            await navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
          } catch (clipboardError) {
            console.error('Error copying to clipboard:', clipboardError);
          }
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
