'use client';

import { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';

const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g', '3g']);
const SLOW_RTT_MS = 600;
const SLOW_DOWNLINK_MBPS = 0.5;

function isConnectionSlow(connection: any): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  if (SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)) return true;
  if (typeof connection.rtt === 'number' && connection.rtt >= SLOW_RTT_MS) return true;
  if (typeof connection.downlink === 'number' && connection.downlink <= SLOW_DOWNLINK_MBPS) return true;
  return false;
}

export default function SlowNetworkBanner() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) return;

    const update = () => setIsSlow(isConnectionSlow(connection));
    update();

    connection.addEventListener('change', update);
    return () => connection.removeEventListener('change', update);
  }, []);

  if (!isSlow) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9998] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm">
      <Wifi size={14} />
      Slow network detected — some actions may take longer than usual
    </div>
  );
}
