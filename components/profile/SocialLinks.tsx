import React from 'react';
import Image from 'next/image';
import { WarningIcon } from '../ui/WarningIcon';
import type { Profile } from '@/types/profile';

interface SocialLink {
  platform: 'x' | 'telegram' | 'zora' | 'farcaster';
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
  compactView = false, // Default to false for detail views
}: SocialLinksProps) {
  const links: SocialLink[] = [];

  // Use profile prop if provided, otherwise use individual props
  const x = profile?.x_handle || xHandle;
  const xValid = profile?.x_handle_valid !== undefined ? profile.x_handle_valid : xHandleValid;
  const telegram = profile?.telegram_handle || telegramHandle;
  const telegramValid = profile?.telegram_handle_valid !== undefined ? profile.telegram_handle_valid : telegramHandleValid;
  const zora = profile?.zora_page_url || zoraPageUrl;
  const zoraValid = profile?.zora_page_valid !== undefined ? profile.zora_page_valid : zoraPageValid;

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

  if (links.length === 0) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No social links added</p>;
  }

  // Compact view for directory (emojis side by side)
  if (compactView) {
    // Find Farcaster link once
    const farcasterLink = links.find(l => l.platform === 'farcaster');
    const otherLinks = links.filter(l => l.platform !== 'farcaster');
    
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
        {otherLinks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
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
          </div>
        )}
      </div>
    );
  }

  // Full view for detail pages (show all usernames)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      {links.map((link) => (
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
      ))}
    </div>
  );
}
