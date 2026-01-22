import type { Metadata } from 'next';
import './globals.css';
import './styles/design-tokens.css';
import './styles/animations.css';
import './styles/components.css';
import { Providers } from '@/lib/wagmi';
import { FrameSDKProvider } from '@/components/FrameSDKProvider';
import { WalletAutoConnect } from '@/components/WalletAutoConnect';

export const metadata: Metadata = {
  title: 'KnownToads - Toadgang Directory',
  description: 'Open address book for the toadgang crypto community',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/IMG_20260121_143212.png',
  },
  openGraph: {
    title: 'KnownToads - Toadgang Directory',
    description: 'Open address book for the toadgang crypto community. Find toads, their creator coins, and connect with the toadgang.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KnownToads - Toadgang Directory',
      },
    ],
    type: 'website',
    siteName: 'KnownToads',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KnownToads - Toadgang Directory',
    description: 'Open address book for the toadgang crypto community',
    images: ['/og-image.png'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': '/og-image.png',
    'fc:frame:button:1': 'View Directory',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'var(--font-body)' }}>
        <FrameSDKProvider>
          <Providers>
            <WalletAutoConnect />
            {children}
          </Providers>
        </FrameSDKProvider>
      </body>
    </html>
  );
}
