import type { Metadata } from 'next';
import './globals.css';
import './styles/design-tokens.css';
import './styles/animations.css';
import './styles/components.css';
import { Providers } from '@/lib/wagmi';
import { FrameSDKProvider } from '@/components/FrameSDKProvider';

export const metadata: Metadata = {
  title: 'KnownToads - Toadgang Directory',
  description: 'Open address book for the toadgang crypto community',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: 'var(--font-body)' }}>
        <FrameSDKProvider>
          <Providers>{children}</Providers>
        </FrameSDKProvider>
      </body>
    </html>
  );
}
