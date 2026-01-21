import type { Metadata } from 'next';
import './globals.css';
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
      <body>
        <FrameSDKProvider>
          <Providers>{children}</Providers>
        </FrameSDKProvider>
      </body>
    </html>
  );
}
