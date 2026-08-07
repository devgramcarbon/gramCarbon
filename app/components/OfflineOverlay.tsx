'use client';

import { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 5000;
const CHECK_TIMEOUT_MS = 4000;

async function checkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    await fetch('/favicon.ico', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export default function OfflineOverlay() {
  const [isOnline, setIsOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runCheck = async () => {
      const online = await checkConnectivity();
      if (!cancelled) setIsOnline(online);
    };

    runCheck();
    intervalRef.current = setInterval(runCheck, CHECK_INTERVAL_MS);

    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => runCheck();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  const handleRetry = async () => {
    setRetrying(true);
    const online = await checkConnectivity();
    setIsOnline(online);
    setRetrying(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white px-4 text-center dark:bg-gray-900">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-500/10">
        <WifiOff size={32} className="text-teal-600 dark:text-teal-400" />
      </div>
      <h1 className="mb-1 text-lg font-semibold text-gray-800 dark:text-gray-100">
        No internet connection
      </h1>
      <p className="mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Check your network connection and try again. This page will resume automatically once you&apos;re back online.
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
