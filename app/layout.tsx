import { Outfit } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} antialiased`}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}})()`,
          }}
        />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
