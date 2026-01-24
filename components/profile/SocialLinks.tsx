'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { WarningIcon } from '../ui/WarningIcon';
import { fetchTokenSymbolWithRetry } from '@/lib/token-helpers';
import type { Profile } from '@/types/profile';

interface SocialLink {
  platform: 'x' | 'telegram' | 'zora' | 'farcaster' | 'contract';
  handle?: string;
  url?: string;
  valid?: boolean;
}

interface SocialLinksProps {
  profile?: Profile;
  xHandle?: string | null;
  xHandleValid?: boolean;
  telegramHandle?: string | null;
  telegramHandleValid?: boolean;
  zoraPageUrl?: string | null;
  zoraPageValid?: boolean;
  creatorCoinAddress?: string | null;
  creatorCoinTicker?: string | null;
  compactView?: boolean; // New prop for directory view
}

export function SocialLinks({
  profile,
  xHandle,
  xHandleValid = true,
  telegramHandle,
  telegramHandleValid = true,
  zoraPageUrl,
  zoraPageValid = true,
  creatorCoinAddress,
  creatorCoinTicker,
  compactView = false, // Default to false for detail views
}: SocialLinksProps) {
  const [tokenTicker, setTokenTicker] = useState<string | null>(null);
  const [isLoadingTicker, setIsLoadingTicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const links: SocialLink[] = [];

  // Use profile prop if provided, otherwise use individual props
  const x = profile?.x_handle || xHandle;
  const xValid = profile?.x_handle_valid !== undefined ? profile.x_handle_valid : xHandleValid;
  const telegram = profile?.telegram_handle || telegramHandle;
  const telegramValid = profile?.telegram_handle_valid !== undefined ? profile.telegram_handle_valid : telegramHandleValid;
  const zora = profile?.zora_page_url || zoraPageUrl;
  const zoraValid = profile?.zora_page_valid !== undefined ? profile.zora_page_valid : zoraPageValid;
  const contractAddress = profile?.creator_coin_address || creatorCoinAddress;
  const ticker = profile?.token_ticker || creatorCoinTicker || tokenTicker;

  // Fetch token symbol if contract address is provided
  useEffect(() => {
    if (contractAddress && !ticker) {
      // Validate contract address format before fetching
      if (contractAddress.startsWith('0x') && contractAddress.length === 42) {
        setIsLoadingTicker(true);
        fetchTokenSymbolWithRetry(contractAddress as `0x${string}`)
          .then(symbol => {
            if (symbol) {
              setTokenTicker(symbol);
            }
          })
          .catch(err => {
            console.error('Error fetching token symbol:', err);
          })
          .finally(() => {
            setIsLoadingTicker(false);
          });
      }
    }
  }, [contractAddress, ticker]);

  // Add Farcaster username (always shown with @username in both views)
  if (profile?.username) {
    links.push({
      platform: 'farcaster',
      handle: profile.username,
      url: `https://warpcast.com/${profile.username}`,
      valid: true,
    });
  }

  if (x) {
    links.push({
      platform: 'x',
      handle: x,
      url: `https://x.com/${x}`,
      valid: xValid,
    });
  }

  if (telegram) {
    links.push({
      platform: 'telegram',
      handle: telegram,
      url: `https://t.me/${telegram}`,
      valid: telegramValid,
    });
  }

  if (zora) {
    links.push({
      platform: 'zora',
      url: zora,
      valid: zoraValid,
    });
  }

  // Add contract link if contract address is available
  if (contractAddress) {
    links.push({
      platform: 'contract',
      handle: isLoadingTicker ? '...' : (ticker || 'TOKEN'),
      url: contractAddress, // Will be used for copying
      valid: true,
    });
  }

  // Handle copy to clipboard
  const handleCopyContract = async () => {
    if (contractAddress) {
      try {
        await navigator.clipboard.writeText(contractAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  if (links.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No social links added</p>;
  }

  // Compact view for directory (emojis side by side)
  if (compactView) {
    // Find Farcaster link once
    const farcasterLink = links.find(l => l.platform === 'farcaster');
    const contractLink = links.find(l => l.platform === 'contract');
    const otherLinks = links.filter(l => l.platform !== 'farcaster' && l.platform !== 'contract');
    const hasOtherLinksOrContract = otherLinks.length > 0 || contractLink;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {/* Farcaster username on its own line */}
        {farcasterLink && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <a
              href={farcasterLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}
            >
              <Image src="/farcaster-logo.svg" alt="Farcaster" width={16} height={16} />
              <span>@{farcasterLink.handle}</span>
            </a>
          </div>
        )}
        {/* Other platforms as emojis only, side by side */}
        {hasOtherLinksOrContract && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            {otherLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title={link.handle ? `@${link.handle}` : link.platform}
              style={{ display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-base)' }}
            >
              {link.platform === 'x' && <Image src="/x-logo.svg" alt="X (Twitter)" width={16} height={16} />}
              {link.platform === 'telegram' && <Image src="/telegram-logo.svg" alt="Telegram" width={16} height={16} />}
              {link.platform === 'zora' && <Image src="/zora-logo.svg" alt="Zora" width={16} height={16} />}
              {!link.valid && <WarningIcon title="This link may be broken or invalid" />}
            </a>
          ))}
          {/* Contract ticker with copy functionality */}
          {contractLink && (
            <button
              onClick={handleCopyContract}
              className="social-link"
              title={`Click to copy contract address: ${contractAddress}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: 'var(--text-xs)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
            >
              <span style={{ color: 'var(--token-accent)', fontWeight: 'bold' }}>${contractLink.handle}</span>
              <span style={{ fontSize: '12px' }}>{copied ? '✓' : '📋'}</span>
            </button>
          )}
        </div>
        )}
      </div>
    );
  }

  // Full view for detail pages (show all usernames)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      {links.map((link) => {
        // Special handling for contract link
        if (link.platform === 'contract') {
          return (
            <div key={link.platform} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <button
                onClick={handleCopyContract}
                className="social-link"
                title={`Click to copy contract address: ${contractAddress}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  fontSize: 'var(--text-sm)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s',
                }}
              >
                <span style={{ fontSize: '20px' }}>💎</span>
                <span style={{ color: 'var(--token-accent)', fontWeight: 'bold' }}>${link.handle}</span>
                <span style={{ fontSize: '14px', marginLeft: '4px' }}>{copied ? '✓ Copied!' : '📋'}</span>
              </button>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {contractAddress?.substring(0, 6)}...{contractAddress?.substring(contractAddress.length - 4)}
              </span>
            </div>
          );
        }

        // Regular social links
        return (
          <div key={link.platform} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--text-sm)' }}
            >
              {link.platform === 'farcaster' && <Image src="/farcaster-logo.svg" alt="Farcaster" width={20} height={20} />}
              {link.platform === 'x' && <Image src="/x-logo.svg" alt="X (Twitter)" width={20} height={20} />}
              {link.platform === 'telegram' && <Image src="/telegram-logo.svg" alt="Telegram" width={20} height={20} />}
              {link.platform === 'zora' && <Image src="/zora-logo.svg" alt="Zora" width={20} height={20} />}
              <span>{link.handle ? `@${link.handle}` : 'Zora'}</span>
            </a>
            
            {!link.valid && (
              <WarningIcon title="This link may be broken or invalid" />
            )}
          </div>
        );
      })}
    </div>
  );
}
