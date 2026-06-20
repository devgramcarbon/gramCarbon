'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { SocketProvider, useSocket } from '../components/SocketProvider';
import NotificationCenter from '../components/NotificationCenter';
import { ToastProvider } from '../components/Toaster';

interface UserData {
  name?: string;
  role?: string;
}

function DashboardContent({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    axios.get<{ success: boolean; data: UserData }>('/api/auth/me').then(({ data }) => {
      if (data.success) setUser(data.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} connected={socket?.connected} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Welcome back,</p>
            <p className="text-base font-semibold text-gray-800">{user?.name || 'Admin'}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
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
