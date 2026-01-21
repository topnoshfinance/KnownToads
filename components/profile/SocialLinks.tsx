import React from 'react';
import { WarningIcon } from '../ui/WarningIcon';
import type { Profile } from '@/types/profile';

interface SocialLink {
  platform: 'x' | 'telegram' | 'zora';
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
  showDirectoryView?: boolean;
}

export function SocialLinks({
  profile,
  xHandle,
  xHandleValid = true,
  telegramHandle,
  telegramHandleValid = true,
  zoraPageUrl,
  zoraPageValid = true,
  showDirectoryView = false,
}: SocialLinksProps) {
  const links: SocialLink[] = [];

  // Use profile prop if provided, otherwise use individual props
  const x = profile?.x_handle || xHandle;
  const xValid = profile?.x_handle_valid !== undefined ? profile.x_handle_valid : xHandleValid;
  const telegram = profile?.telegram_handle || telegramHandle;
  const telegramValid = profile?.telegram_handle_valid !== undefined ? profile.telegram_handle_valid : telegramHandleValid;
  const zora = profile?.zora_page_url || zoraPageUrl;
  const zoraValid = profile?.zora_page_valid !== undefined ? profile.zora_page_valid : zoraPageValid;

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

  return (
    <div style={{ display: 'flex', flexDirection: showDirectoryView ? 'row' : 'column', gap: 'var(--spacing-sm)', justifyContent: showDirectoryView ? 'center' : 'flex-start' }}>
      {links.map((link) => (
        <div key={link.platform} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
          >
            {link.platform === 'x' && <span style={{ fontSize: 'var(--text-xl)' }}>🐦</span>}
            {link.platform === 'telegram' && <span style={{ fontSize: 'var(--text-xl)' }}>💬</span>}
            {link.platform === 'zora' && <span style={{ fontSize: 'var(--text-xl)' }}>🎨</span>}
            {!showDirectoryView && <span>{link.handle ? `@${link.handle}` : 'Zora'}</span>}
          </a>
          
          {!link.valid && !showDirectoryView && (
            <WarningIcon title="This link may be broken or invalid" />
          )}
        </div>
      ))}
    </div>
  );
}
