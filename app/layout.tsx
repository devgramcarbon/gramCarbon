import { Outfit } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from './components/Toaster';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'gramCarbon Console | Feed Distribution Platform',
  description: 'Enterprise feed distribution management and traceability system',
  icons: {
    icon: '/gramfav.png',
    apple: '/gramfav.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} bg-gray-50 text-gray-900 antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
