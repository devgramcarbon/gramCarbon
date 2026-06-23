'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const redirect = setTimeout(() => {
      router.push('/dashboard');
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-white dark:from-[#0a1f12] dark:to-[#0d1117] px-4">
      <div className="text-center max-w-lg">
        <div className="mb-6">
          <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
            Gram Carbon
          </span>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-3">CH4OW Feed Additive</h1>
        <h2 className="text-2xl font-semibold text-green-600 mb-4">Traceability System</h2>

        <p className="text-gray-500 mb-8 leading-relaxed">
          Real-time tracking of CH4OW feed additive distribution across distributors and farmers. Powered by WhatsApp Bot integration.
        </p>

        <p className="text-gray-400 text-sm mb-4">
          Redirecting to dashboard in {countdown}s…
        </p>

        <Link href="/dashboard" className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
          Go to Dashboard
        </Link>
      </div>

      <footer className="absolute bottom-6 text-gray-400 text-sm">
        © {new Date().getFullYear()} Gram Carbon. All rights reserved.
      </footer>
    </main>
  );
}
