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
