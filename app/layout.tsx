import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QueryProvider } from '@/components/QueryProvider';
import { SignalingProvider } from '@/components/SignalingProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Aura | The Intelligent Social Network',
  description: 'A modern, premium social network with Dynamic Intelligent Interests.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="bg-background text-foreground min-h-screen flex flex-col font-sans" suppressHydrationWarning>
        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <SignalingProvider>
                {children}
              </SignalingProvider>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
