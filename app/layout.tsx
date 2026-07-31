import { Outfit } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from './components/Toaster';
import OfflineOverlay from './components/OfflineOverlay';
import SlowNetworkBanner from './components/SlowNetworkBanner';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${outfit.className} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
        <SlowNetworkBanner />
        <OfflineOverlay />
      </body>
    </html>
  );
}
