'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <Link href="/">
        <Image
          src="/toby-logo.svg"
          alt="Toby - Toadgang Mascot"
          width={50}
          height={50}
          className="logo"
          priority
        />
      </Link>
      <nav style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
        <Link 
          href="/"
          style={{
            fontWeight: pathname === '/' ? 'var(--font-bold)' : 'var(--font-medium)',
            borderBottom: pathname === '/' ? '3px solid var(--toby-blue)' : 'none',
            paddingBottom: 'var(--spacing-xs)',
          }}
        >
          Directory
        </Link>
        <Link 
          href="/profile/edit"
          style={{
            fontWeight: pathname === '/profile/edit' ? 'var(--font-bold)' : 'var(--font-medium)',
            borderBottom: pathname === '/profile/edit' ? '3px solid var(--toby-blue)' : 'none',
            paddingBottom: 'var(--spacing-xs)',
          }}
        >
          My Profile
        </Link>
      </nav>
    </header>
  );
}
