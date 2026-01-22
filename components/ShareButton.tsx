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
      if (typeof window !== 'undefined' && (window as any).farcaster?.share) {
        (window as any).farcaster.share({
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
        } else {
          // Last resort: copy to clipboard
          await navigator.clipboard.writeText(url);
          alert('Link copied to clipboard!');
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
