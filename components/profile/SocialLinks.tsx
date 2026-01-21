import React from 'react';
import { WarningIcon } from '../ui/WarningIcon';

interface SocialLink {
  platform: 'x' | 'telegram' | 'zora';
  handle?: string;
  url?: string;
  valid?: boolean;
}

interface SocialLinksProps {
  xHandle?: string | null;
  xHandleValid?: boolean;
  telegramHandle?: string | null;
  telegramHandleValid?: boolean;
  zoraPageUrl?: string | null;
  zoraPageValid?: boolean;
}

export function SocialLinks({
  xHandle,
  xHandleValid = true,
  telegramHandle,
  telegramHandleValid = true,
  zoraPageUrl,
  zoraPageValid = true,
}: SocialLinksProps) {
  const links: SocialLink[] = [];

  if (xHandle) {
    links.push({
      platform: 'x',
      handle: xHandle,
      url: `https://x.com/${xHandle}`,
      valid: xHandleValid,
    });
  }

  if (telegramHandle) {
    links.push({
      platform: 'telegram',
      handle: telegramHandle,
      url: `https://t.me/${telegramHandle}`,
      valid: telegramHandleValid,
    });
  }

  if (zoraPageUrl) {
    links.push({
      platform: 'zora',
      url: zoraPageUrl,
      valid: zoraPageValid,
    });
  }

  if (links.length === 0) {
    return <p className="text-gray-500 text-sm">No social links added</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {links.map((link) => (
        <div key={link.platform} className="flex items-center gap-2">
          {link.platform === 'x' && <span className="text-xl">🐦</span>}
          {link.platform === 'telegram' && <span className="text-xl">💬</span>}
          {link.platform === 'zora' && <span className="text-xl">🎨</span>}
          
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-700 underline"
          >
            {link.handle ? `@${link.handle}` : 'Zora'}
          </a>
          
          {!link.valid && (
            <WarningIcon title="This link may be broken or invalid" />
          )}
        </div>
      ))}
    </div>
  );
}
