'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { SocketProvider, useSocket } from '../components/SocketProvider';
import NotificationCenter from '../components/NotificationCenter';
import { ToastProvider } from '../components/Toaster';
import ThemeToggle from '../components/ThemeToggle';

interface UserData {
  name?: string;
  role?: string;
}

function DashboardContent({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [user, setUser] = useState<UserData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    axios.get<{ success: boolean; data: UserData }>('/api/auth/me').then(({ data }) => {
      if (data.success) setUser(data.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#0d1117]">
      <Sidebar user={user} connected={socket?.connected} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#161b22]/90 backdrop-blur border-b border-gray-100 dark:border-[#21262d] px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#1c2128] hover:bg-gray-50 dark:hover:bg-[#21262d] transition-colors"
            >
              <Menu size={17} className="text-gray-600 dark:text-[#cdd9e5]" />
            </button>
            <div className="min-w-0">
              <p className="hidden sm:block text-xs text-gray-500 dark:text-[#768390] truncate leading-tight">Welcome back,</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-[#cdd9e5] truncate leading-tight">{user?.name || 'Admin'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <ThemeToggle />
            <NotificationCenter />
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <ToastProvider>
        <DashboardContent>{children}</DashboardContent>
      </ToastProvider>
    </SocketProvider>
  );
}
