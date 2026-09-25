import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { validateEnv } from '@/lib/env';
import './globals.css';

// Runs once when this server module is first loaded (app startup / cold
// start) and throws in production if required config is missing.
validateEnv();

export const metadata: Metadata = {
  title: 'Vayro Driver',
  description: 'Drive with Vayro — manage rides, documents, and availability',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0B0B0D',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#141414', color: '#F5F5F5', border: '1px solid #2A2A2A' },
          }}
        />
      </body>
    </html>
  );
}
