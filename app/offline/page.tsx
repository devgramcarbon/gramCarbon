'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      router.replace('/');
    }
  }, [isOnline, router]);

  const handleRetry = () => {
    setRetrying(true);
    if (navigator.onLine) {
      router.replace('/');
    } else {
      setTimeout(() => setRetrying(false), 800);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center dark:bg-gray-900">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-500/10">
        <WifiOff size={32} className="text-teal-600 dark:text-teal-400" />
      </div>
      <h1 className="mb-1 text-lg font-semibold text-gray-800 dark:text-gray-100">
        No internet connection
      </h1>
      <p className="mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Check your network connection and try again. We&apos;ll take you back automatically once you&apos;re back online.
      </p>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
      >
        <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Checking…' : 'Retry'}
      </button>
    </div>
  );
}
